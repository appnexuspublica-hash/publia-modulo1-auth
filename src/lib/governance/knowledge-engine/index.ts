import { analyzeGovernanceQuery } from "./analyzer";
import { buildKnowledgeContextText } from "./context";
import {
  buildLegalCatalogContext,
  getGovernanceLegalCatalogForQuery,
} from "./legal-catalog";
import {
  loadInstitutionalKnowledgeItems,
  loadOfficialGazetteKnowledgeItems,
  loadOfficialSourcesKnowledgeItems,
} from "./providers";
import { sortAndFilterKnowledgeItems } from "./scorer";
import type { BuildGovernanceKnowledgeContextParams, GovernanceKnowledgeContext } from "./types";

const DEFAULT_MAX_CONTEXT_CHARS = 18000;
const MAX_ITEMS_PER_PROVIDER = 5;
const MAX_TOTAL_ITEMS = 10;

function capPerProvider<T extends { provider: string }>(items: T[]) {
  const counts = new Map<string, number>();

  return items.filter((item) => {
    const count = counts.get(item.provider) ?? 0;

    if (count >= MAX_ITEMS_PER_PROVIDER) {
      return false;
    }

    counts.set(item.provider, count + 1);
    return true;
  });
}

function buildAnalyzerContext(params: {
  analysis: ReturnType<typeof analyzeGovernanceQuery>;
  selectedTitles: string[];
}) {
  const lines: string[] = [
    "ANÁLISE DA PERGUNTA PELO KNOWLEDGE ENGINE:",
    `- Tópico identificado: ${params.analysis.topic}`,
  ];

  if (params.analysis.priorityTerms.length > 0) {
    lines.push(`- Termos prioritários: ${params.analysis.priorityTerms.join(", ")}`);
  }

  if (params.analysis.excludedTerms.length > 0) {
    lines.push(`- Termos/documentos a evitar neste tema: ${params.analysis.excludedTerms.join(", ")}`);
  }

  if (params.selectedTitles.length > 0) {
    lines.push(`- Documentos priorizados pelo ranking: ${params.selectedTitles.join(" | ")}`);
  }

  if (params.analysis.instructions.length > 0) {
    lines.push("", "REGRAS ESPECÍFICAS PARA ESTA PERGUNTA:");
    lines.push(...params.analysis.instructions.map((instruction) => `- ${instruction}`));
  }

  if (params.analysis.requiresCurrentDocument) {
    lines.push(
      "- Regra de atualidade: para titular atual de cargo eletivo, use somente documentos do mandato atual ou fonte oficial atual. Não use documentos históricos para responder titular atual.",
    );
  }

  return lines.join("\n");
}

export async function buildGovernanceKnowledgeContext(
  params: BuildGovernanceKnowledgeContextParams,
): Promise<GovernanceKnowledgeContext> {
  const analysis = analyzeGovernanceQuery(params.question);
  const legalCatalog = getGovernanceLegalCatalogForQuery(analysis);

  const [institutional, officialGazette, officialSources] = await Promise.all([
    loadInstitutionalKnowledgeItems(params),
    loadOfficialGazetteKnowledgeItems(params),
    loadOfficialSourcesKnowledgeItems(params),
  ]);

  const ranked = sortAndFilterKnowledgeItems([
    ...institutional,
    ...officialGazette,
    ...officialSources,
  ]);

  const selected = capPerProvider(ranked).slice(0, MAX_TOTAL_ITEMS);

  const baseContext = buildKnowledgeContextText({
    question: params.question,
    items: selected,
    maxContextChars: params.maxContextChars ?? DEFAULT_MAX_CONTEXT_CHARS,
  });

  const analyzerContext = buildAnalyzerContext({
    analysis,
    selectedTitles: selected.map((item) => item.title).slice(0, 8),
  });

  const legalContext = buildLegalCatalogContext(legalCatalog);

  return {
    ...baseContext,
    contextText: [analyzerContext, legalContext, baseContext.contextText]
      .filter((section) => section && section.trim().length > 0)
      .join("\n\n"),
    diagnostics: {
      ...baseContext.diagnostics,
      analysis_topic: analysis.topic,
      legal_catalog_items: legalCatalog.length,
    } as GovernanceKnowledgeContext["diagnostics"] & {
      analysis_topic: string;
      legal_catalog_items: number;
    },
  };
}

export type {
  BuildGovernanceKnowledgeContextParams,
  GovernanceKnowledgeContext,
  GovernanceKnowledgeItem,
  GovernanceKnowledgeProvider,
  GovernanceKnowledgeSource,
} from "./types";

export { analyzeGovernanceQuery } from "./analyzer";
