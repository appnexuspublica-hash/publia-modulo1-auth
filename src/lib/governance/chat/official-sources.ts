// src/lib/governance/chat/official-sources.ts
import { createWritableSupabaseRouteClient } from "@/lib/governance/chat/infrastructure";

type GovernanceOfficialSourceForChat = {
  id: string;
  organization_id: string;
  name: string;
  source_type: string;
  url: string;
  notes: string | null;
  status: string;
  priority: string | null;
  reviewed_at: string | null;
};

function normalizeOfficialSourcePriority(priority: string | null | undefined) {
  const normalizedPriority = String(priority ?? "medium")
    .trim()
    .toLowerCase();

  if (["alta", "high", "1"].includes(normalizedPriority)) {
    return "alta";
  }

  if (["baixa", "low", "3"].includes(normalizedPriority)) {
    return "baixa";
  }

  return "media";
}

function getOfficialSourcePriorityLabel(priority: string | null | undefined) {
  const normalizedPriority = normalizeOfficialSourcePriority(priority);

  if (normalizedPriority === "alta") {
    return "Alta";
  }

  if (normalizedPriority === "baixa") {
    return "Baixa";
  }

  return "Média";
}

function getOfficialSourcePriorityRank(priority: string | null | undefined) {
  const normalizedPriority = normalizeOfficialSourcePriority(priority);

  if (normalizedPriority === "alta") {
    return 1;
  }

  if (normalizedPriority === "media") {
    return 2;
  }

  return 3;
}

function getOfficialSourceTypeLabel(sourceType: string | null | undefined) {
  switch (sourceType) {
    case "municipal_website":
      return "Site municipal";
    case "official_gazette":
      return "Diário oficial";
    case "transparency_portal":
      return "Portal da transparência";
    case "institutional_repository":
      return "Repositório institucional";
    case "other":
      return "Outra fonte";
    default:
      return sourceType ? String(sourceType) : "Tipo não informado";
  }
}

function normalizeOfficialSourceSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

type OfficialSourceIntent =
  | "legislation"
  | "official_gazette"
  | "transparency"
  | "institutional"
  | "bidding"
  | "generic";

function detectOfficialSourceIntent(question: string): OfficialSourceIntent {
  const normalizedQuestion = normalizeOfficialSourceSearchText(question);

  if (
    /\b(lei|leis|legislacao|legislativo|decreto|decretos|portaria|portarias|codigo|norma|normas|ato administrativo|atos administrativos|lei organica)\b/.test(
      normalizedQuestion,
    )
  ) {
    return "legislation";
  }

  if (
    /\b(diario oficial|diario|edicao|publicacao|publicado|publicada|publicados|publicadas|edital|extrato|ratificacao)\b/.test(
      normalizedQuestion,
    )
  ) {
    return "official_gazette";
  }

  if (
    /\b(transparencia|receita|receitas|despesa|despesas|empenho|empenhos|pagamento|pagamentos|orcamento|prestacao de contas)\b/.test(
      normalizedQuestion,
    )
  ) {
    return "transparency";
  }

  if (/\b(licitacao|licitacoes|dispensa|inexigibilidade|pregao|contrato|contratos)\b/.test(normalizedQuestion)) {
    return "bidding";
  }

  if (/\b(site|portal|pagina oficial|endereco|url|link|acessar|acesso)\b/.test(normalizedQuestion)) {
    return "institutional";
  }

  return "generic";
}

function getOfficialSourceIntentLabel(intent: OfficialSourceIntent) {
  switch (intent) {
    case "legislation":
      return "legislação municipal, leis, decretos, portarias e atos administrativos";
    case "official_gazette":
      return "Diário Oficial, edições, publicações, editais, extratos e atos publicados";
    case "transparency":
      return "Portal da Transparência, receitas, despesas, empenhos, orçamento e prestação de contas";
    case "bidding":
      return "licitações, dispensas, inexigibilidades, pregões e contratos";
    case "institutional":
      return "site, portal, URL, acesso e páginas oficiais";
    case "generic":
    default:
      return "referências oficiais gerais da organização";
  }
}

function getOfficialSourceTextForScoring(source: GovernanceOfficialSourceForChat) {
  return normalizeOfficialSourceSearchText(
    [
      source.name,
      source.source_type,
      source.url,
      source.notes,
      getOfficialSourceTypeLabel(source.source_type),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function scoreOfficialSourceForQuestion(
  source: GovernanceOfficialSourceForChat,
  question: string,
) {
  const intent = detectOfficialSourceIntent(question);
  const text = getOfficialSourceTextForScoring(source);
  const sourceName = normalizeOfficialSourceSearchText(String(source.name ?? ""));
  const sourceUrl = normalizeOfficialSourceSearchText(String(source.url ?? ""));
  const sourceType = normalizeOfficialSourceSearchText(String(source.source_type ?? ""));
  let score = 0;

  score += Math.max(0, 4 - getOfficialSourcePriorityRank(source.priority));

  if (intent === "legislation") {
    const isExplicitLegislationSource =
      /legislacao municipal|legislacao|leis municipais|leis|atos administrativos|atos-administrativos|lei organica/.test(
        sourceName,
      ) ||
      /leis-e-atos-administrativos|leis|atos-administrativos|legislacao|lei-organica/.test(
        sourceUrl,
      );

    const isGenericTransparencySource =
      /portal da transparencia|transparencia/.test(sourceName) &&
      !/leis|atos|legislacao/.test(sourceName) &&
      !/leis|atos-administrativos|legislacao/.test(sourceUrl);

    const isOfficialGazetteSource = /diario oficial|official_gazette|gazette/.test(text);

    if (isExplicitLegislationSource) score += 500;
    if (/legislacao|leis|lei|atos administrativos|atos-administrativos|lei organica/.test(text)) score += 120;
    if (/transparencia.*leis|leis.*atos|leis-e-atos-administrativos/.test(text)) score += 100;
    if (isOfficialGazetteSource) score += 15;
    if (isGenericTransparencySource) score -= 80;
  }

  if (intent === "official_gazette") {
    if (/diario oficial|official_gazette|gazette|publicacao|edicao/.test(text)) score += 120;
    if (/leis|legislacao|atos administrativos/.test(text)) score += 15;
  }

  if (intent === "transparency") {
    if (/transparencia|transparency|receita|despesa|empenho|orcamento|prestacao/.test(text)) score += 120;
    if (/leis-e-atos-administrativos|legislacao municipal/.test(text)) score -= 20;
  }

  if (intent === "bidding") {
    if (/licitacao|licitacoes|pregao|contrato|contratos|dispensa|inexigibilidade/.test(text)) score += 120;
    if (/transparencia|transparência|betha|betha contabil|betha contábil/.test(text)) score += 120;
    if (/diario oficial/.test(text)) score += 40;
    if (/portal|site oficial|municipal_website/.test(text)) score += 35;
  }

  if (intent === "institutional") {
    if (/site municipal|municipal_website|portal|prefeitura|municipio/.test(text)) score += 80;
  }

  if (sourceType.includes(intent)) {
    score += 20;
  }

  const normalizedQuestion = normalizeOfficialSourceSearchText(question);
  const questionWords = normalizedQuestion
    .split(/\W+/)
    .filter((word) => word.length >= 4);

  for (const word of questionWords) {
    if (text.includes(word)) {
      score += 4;
    }
  }

  return {
    score,
    intent,
  };
}

function sortOfficialSourcesForQuestion(
  sources: GovernanceOfficialSourceForChat[],
  question: string,
) {
  return [...sources].sort((a, b) => {
    const scoreA = scoreOfficialSourceForQuestion(a, question).score;
    const scoreB = scoreOfficialSourceForQuestion(b, question).score;

    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    const priorityDiff =
      getOfficialSourcePriorityRank(a.priority) - getOfficialSourcePriorityRank(b.priority);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR", {
      sensitivity: "base",
      numeric: true,
    });
  });
}

type PrioritizedOfficialSourceForChat = {
  source: GovernanceOfficialSourceForChat;
  score: number;
  intent: OfficialSourceIntent;
};

function getPrioritizedOfficialSourceForQuestion(
  sources: GovernanceOfficialSourceForChat[],
  question: string,
): PrioritizedOfficialSourceForChat | null {
  const intent = detectOfficialSourceIntent(question);

  if (intent === "legislation") {
    const explicitLegislationSource = sources.find((source) => {
      const sourceName = normalizeOfficialSourceSearchText(String(source.name ?? ""));
      const sourceUrl = normalizeOfficialSourceSearchText(String(source.url ?? ""));
      const sourceNotes = normalizeOfficialSourceSearchText(String(source.notes ?? ""));

      return (
        /legislacao municipal|legislacao|leis municipais|leis|atos administrativos|lei organica/.test(
          sourceName,
        ) ||
        /leis-e-atos-administrativos|legislacao|lei-organica/.test(sourceUrl) ||
        /legislacao municipal|leis municipais|atos administrativos|lei organica/.test(sourceNotes)
      );
    });

    if (explicitLegislationSource) {
      return {
        source: explicitLegislationSource,
        score: 10000,
        intent,
      };
    }
  }

  const sortedSources = sortOfficialSourcesForQuestion(sources, question);
  const scoredSources = sortedSources.map((source) => ({
    source,
    ...scoreOfficialSourceForQuestion(source, question),
  }));

  return scoredSources.find((item) => item.score >= 25) ?? null;
}

function buildOfficialSourcesContextText(
  sources: GovernanceOfficialSourceForChat[],
  question: string,
) {
  if (sources.length === 0) {
    return "";
  }

  const sortedSources = sortOfficialSourcesForQuestion(sources, question);
  const prioritizedSource = getPrioritizedOfficialSourceForQuestion(sources, question);
  const detectedIntent = detectOfficialSourceIntent(question);

  const lines = [
    "FONTES OFICIAIS CADASTRADAS DA ORGANIZAÇÃO",
    "",
    "Use estas fontes como referência preferencial para indicar links oficiais do órgão atual.",
    "Regra obrigatória: quando existir uma fonte oficial cadastrada claramente relacionada ao assunto da pergunta, cite essa fonte específica com a URL oficial cadastrada.",
    "Regra obrigatória: para perguntas sobre onde encontrar leis, legislação, decretos, portarias ou atos administrativos, responda primeiro com a fonte Legislação Municipal quando ela estiver cadastrada.",
    "Não substitua uma fonte específica por uma fonte genérica. Exemplo: para perguntas sobre leis, legislação, decretos, portarias ou atos administrativos, priorize a fonte de Legislação Municipal, quando cadastrada.",
    "Não afirme que consultou o conteúdo da página em tempo real; use os links como referências oficiais cadastradas.",
    "",
    prioritizedSource
      ? [
          "FONTE OFICIAL PRIORITÁRIA PARA ESTA PERGUNTA",
          `Nome exato obrigatório: ${String(prioritizedSource.source.name ?? "Fonte oficial").trim()}`,
          `Tipo: ${getOfficialSourceTypeLabel(prioritizedSource.source.source_type)}`,
          `Prioridade cadastrada: ${getOfficialSourcePriorityLabel(prioritizedSource.source.priority)}`,
          `URL exata obrigatória: ${String(prioritizedSource.source.url ?? "").trim()}`,
          `Motivo: a pergunta foi classificada como relacionada a ${getOfficialSourceIntentLabel(prioritizedSource.intent)}.`,
          "Instrução obrigatória: comece a orientação de consulta por esta fonte prioritária.",
          "Instrução obrigatória: cite o nome exato obrigatório e a URL exata obrigatória antes de qualquer fonte genérica.",
          "Instrução obrigatória: não troque, resuma, encurte ou substitua esta URL por outro endereço.",
          "Instrução obrigatória: se a fonte prioritária for Legislação Municipal, não substitua por Portal da Transparência genérico nem por Diário Oficial.",
          "",
        ].join("\n")
      : [
          "ASSUNTO IDENTIFICADO",
          `A pergunta foi classificada como relacionada a ${getOfficialSourceIntentLabel(detectedIntent)}.`,
          "Nenhuma fonte específica superou o limite de priorização; use a lista abaixo por ordem de relevância e prioridade.",
          "",
        ].join("\n"),
    "DEMAIS FONTES OFICIAIS ATIVAS, ORDENADAS POR RELEVÂNCIA PARA A PERGUNTA",
    "",
    ...sortedSources.flatMap((source, index) => [
      `${index + 1}. ${String(source.name ?? "Fonte oficial").trim()}`,
      `   Tipo: ${getOfficialSourceTypeLabel(source.source_type)}`,
      `   Prioridade: ${getOfficialSourcePriorityLabel(source.priority)}`,
      `   URL oficial cadastrada: ${String(source.url ?? "").trim()}`,
      source.notes ? `   Observações: ${String(source.notes).trim()}` : "",
      source.reviewed_at ? `   Última revisão: ${source.reviewed_at}` : "",
      "",
    ]),
  ];

  return lines.filter((line) => line !== "").join("\n").trim();
}

function resolveMandatoryOfficialSourceForFinalAnswer(params: {
  sources: GovernanceOfficialSourceForChat[];
  prioritizedSource: PrioritizedOfficialSourceForChat | null;
  question: string;
}) {
  const { sources, prioritizedSource, question } = params;
  const intent = detectOfficialSourceIntent(question);

  if (intent === "legislation") {
    const legislationSource = sources.find((source) => {
      const sourceName = normalizeOfficialSourceSearchText(String(source.name ?? ""));
      const sourceUrl = normalizeOfficialSourceSearchText(String(source.url ?? ""));
      const sourceNotes = normalizeOfficialSourceSearchText(String(source.notes ?? ""));

      return (
        /legislacao municipal|legislacao|leis municipais|leis|atos administrativos|lei organica/.test(
          sourceName,
        ) ||
        /leis-e-atos-administrativos|legislacao|lei-organica/.test(sourceUrl) ||
        /legislacao municipal|leis municipais|atos administrativos|lei organica/.test(sourceNotes)
      );
    });

    if (legislationSource) {
      return legislationSource;
    }
  }

  return prioritizedSource?.source ?? null;
}

export function applyOfficialSourceCitationGuard(params: {
  assistantText: string;
  sources: GovernanceOfficialSourceForChat[];
  prioritizedSource: PrioritizedOfficialSourceForChat | null;
  question: string;
}) {
  const { assistantText, sources, prioritizedSource, question } = params;

  const mandatorySource = resolveMandatoryOfficialSourceForFinalAnswer({
    sources,
    prioritizedSource,
    question,
  });

  if (!mandatorySource) {
    return assistantText;
  }

  const sourceName = String(mandatorySource.name ?? "Fonte oficial").trim();
  const sourceUrl = String(mandatorySource.url ?? "").trim();

  if (!sourceName || !sourceUrl) {
    return assistantText;
  }

  const normalizedAssistantText = normalizeOfficialSourceSearchText(assistantText);
  const normalizedSourceName = normalizeOfficialSourceSearchText(sourceName);
  const hasExactUrl = assistantText.includes(sourceUrl);
  const hasSourceName = normalizedAssistantText.includes(normalizedSourceName);

  if (hasExactUrl && hasSourceName) {
    return assistantText;
  }

  const guardBlock = [
    "Referência oficial específica cadastrada:",
    `- ${sourceName}: ${sourceUrl}`,
  ].join("\n");

  return `${assistantText.trim()}\n\n${guardBlock}`;
}

export async function loadActiveOfficialSourcesForChat(params: {
  client: ReturnType<typeof createWritableSupabaseRouteClient>;
  organizationId: string;
  question: string;
}) {
  const { client, organizationId, question } = params;

  const { data, error } = await client
    .from("official_sources")
    .select(
      `
        id,
        organization_id,
        name,
        source_type,
        url,
        notes,
        status,
        priority,
        reviewed_at
      `,
    )
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.warn(
      "[governance/chat] Não foi possível carregar fontes oficiais ativas:",
      error,
    );

    return {
      sources: [] as GovernanceOfficialSourceForChat[],
      prioritizedSource: null as PrioritizedOfficialSourceForChat | null,
      contextText: "",
      error: "Não foi possível carregar as fontes oficiais cadastradas.",
    };
  }

  const sources = ((data ?? []) as GovernanceOfficialSourceForChat[])
    .filter((source) => String(source.url ?? "").trim().length > 0);

  return {
    sources,
    prioritizedSource: getPrioritizedOfficialSourceForQuestion(sources, question),
    contextText: buildOfficialSourcesContextText(sources, question),
    error: "",
  };
}
