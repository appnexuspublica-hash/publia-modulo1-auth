import { chunkText, pickRelevantChunks } from "@/lib/pdf/chunking";
import {
  createWritableSupabaseRouteClient,
} from "@/lib/governance/chat/infrastructure";
import { clampText, normalizePdfText } from "@/lib/governance/chat/pdf-context";
import type { GovernanceChatSource } from "@/lib/governance/chat/references";
import {
  getInstitutionalDocumentTypeLabel,
  isInstitutionalDocumentAvailable,
  type InstitutionalContextResult,
  type InstitutionalDocumentContextRow,
} from "@/lib/governance/chat/institutional-documents";
import {
  getInstitutionalDocumentPriorityBoost,
  getInstitutionalQueryPhrases,
  getInstitutionalQuestionGuard,
  getInstitutionalSearchTokens,
  isLocalOfficeHolderQuestion,
  normalizeInstitutionalSearchText,
  scoreLocalOfficeHolderDocument,
} from "@/lib/governance/chat/institutional-query";

const MAX_INSTITUTIONAL_CONTEXT_CHARS = 24000;
const MAX_INSTITUTIONAL_DOCUMENTS = 30;
const MAX_INSTITUTIONAL_SELECTED_CHUNKS = 24;

function buildInstitutionalStorageOpenUrl(documentId: string) {
  return `/api/governance/institutional-documents?action=open&documentId=${encodeURIComponent(documentId)}`;
}

async function resolveInstitutionalDocumentUrl(
  _client: ReturnType<typeof createWritableSupabaseRouteClient>,
  document: InstitutionalDocumentContextRow,
) {
  const sourceUrl = String(document.source_url ?? "").trim();

  if (/^https?:\/\//i.test(sourceUrl)) {
    return sourceUrl;
  }

  const storageBucket = String(document.storage_bucket ?? "").trim();
  const storagePath = String(document.storage_path ?? "").trim();
  const documentId = String(document.id ?? "").trim();

  /*
    v13.10 — o chat persiste uma URL interna estável. A rota autenticada
    gera uma URL assinada nova no momento do clique e redireciona para o
    arquivo no Supabase Storage. Assim, links em conversas antigas não expiram.
  */
  if (documentId && storageBucket && storagePath) {
    return buildInstitutionalStorageOpenUrl(documentId);
  }

  const normalizedTitle = normalizeInstitutionalSearchText(document.title);
  if (
    normalizedTitle.includes("lei estadual") &&
    (normalizedTitle.includes("cria") || normalizedTitle.includes("criacao")) &&
    normalizedTitle.includes("municipio")
  ) {
    return "https://www.legislacao.pr.gov.br/legislacao/pesquisarAto.do?action=exibir&codAto=12935&indice=1&totalRegistros=1";
  }

  if (documentId) {
    return `/governanca/base-institucional?documentId=${encodeURIComponent(documentId)}`;
  }

  return null;
}

async function buildInstitutionalSource(
  client: ReturnType<typeof createWritableSupabaseRouteClient>,
  document: InstitutionalDocumentContextRow,
): Promise<GovernanceChatSource> {
  const title =
    String(document.title ?? "").trim() ||
    "Documento institucional sem título";

  return {
    id: document.id,
    title,
    url: await resolveInstitutionalDocumentUrl(client, document),
    type: getInstitutionalDocumentTypeLabel(document.document_type),
    supportText:
      String(document.extracted_text ?? "").trim().slice(0, 12000) || null,
  };
}


function scoreInstitutionalDocumentForQuestion(
  document: InstitutionalDocumentContextRow,
  question: string,
) {
  const q = normalizeInstitutionalSearchText(question);
  const title = normalizeInstitutionalSearchText(document.title);
  const type = normalizeInstitutionalSearchText(document.document_type);
  const text = normalizeInstitutionalSearchText(
    String(document.extracted_text ?? "").slice(0, 30000),
  );

  if (!q || !title) {
    return 0;
  }

  let score = 0;
  const queryTokens = getInstitutionalSearchTokens(question);
  const titleTokens = new Set(getInstitutionalSearchTokens(title));
  const phrases = getInstitutionalQueryPhrases(question);

  if (q.length >= 6 && (title.includes(q) || q.includes(title))) {
    score += 180;
  }

  for (const phrase of phrases) {
    if (title.includes(phrase)) {
      score += 170;
    }

    if (type.includes(phrase)) {
      score += 60;
    }

    if (text.includes(phrase)) {
      score += 18;
    }
  }

  for (const token of queryTokens) {
    if (titleTokens.has(token) || title.includes(token)) {
      score += 28;
    } else if (type.includes(token)) {
      score += 12;
    } else if (text.includes(token)) {
      score += 3;
    }
  }

  const matchedTitleTokens = queryTokens.filter(
    (token) => titleTokens.has(token) || title.includes(token),
  );

  if (queryTokens.length >= 2 && matchedTitleTokens.length >= 2) {
    score += 70;
  }

  if (queryTokens.length >= 3 && matchedTitleTokens.length >= queryTokens.length - 1) {
    score += 60;
  }

  if (/\bata\b/.test(q) && title.includes("ata")) {
    score += 90;
  }

  if (/\bposse\b/.test(q) && title.includes("posse")) {
    score += 90;
  }

  if (/\bplano\b/.test(q) && /\bdiretor\b/.test(q) && title.includes("plano") && title.includes("diretor")) {
    score += 130;
  }

  if (/\bestatuto\b/.test(q) && title.includes("estatuto")) {
    score += 120;
  }

  if (/\blei\b/.test(q) && /\borganica\b/.test(q) && title.includes("lei") && title.includes("organica")) {
    score += 130;
  }

  if (/\bcodigo\b/.test(q) && /\btributario\b/.test(q) && title.includes("codigo") && title.includes("tributario")) {
    score += 130;
  }

  score += scoreLocalOfficeHolderDocument(document, question);
  score += getInstitutionalDocumentPriorityBoost(document, question);

  return score;
}

function selectRelevantInstitutionalDocuments(
  rows: InstitutionalDocumentContextRow[],
  question: string,
) {
  const isOfficeHolderQuestion = isLocalOfficeHolderQuestion(question);
  const guard = getInstitutionalQuestionGuard(question);
  const minimumScore = isOfficeHolderQuestion ? 18 : guard ? 45 : 28;

  let ranked = rows
    .map((document) => ({
      document,
      score: scoreInstitutionalDocumentForQuestion(document, question),
    }))
    .filter((item) => item.score >= minimumScore)
    .sort((a, b) => b.score - a.score);

  if (guard) {
    const guarded = ranked.filter((item) => guard.accepts(item.document));

    if (guarded.length > 0) {
      return guarded.slice(0, guard.maxDocuments);
    }

    return [];
  }

  if (ranked.length === 0) {
    return [];
  }

  const topScore = ranked[0]?.score ?? 0;
  const minScore = Math.max(
    minimumScore,
    topScore >= 120 ? topScore * 0.65 : minimumScore,
  );
  const maxDocuments = isOfficeHolderQuestion ? 4 : topScore >= 120 ? 1 : 3;

  return ranked
    .filter((item) => item.score >= minScore)
    .slice(0, maxDocuments);
}


export async function buildInstitutionalDocumentsContext(params: {
  client: ReturnType<typeof createWritableSupabaseRouteClient>;
  organizationId: string;
  question: string;
}): Promise<InstitutionalContextResult> {
  const { client, organizationId, question } = params;

  const { data, error } = await client
    .from("institutional_documents")
    .select(
      `
        id,
        title,
        document_type,
        source_url,
        storage_bucket,
        storage_path,
        extracted_text,
        indexing_status,
        review_status,
        indexed_at,
        updated_at
      `,
    )
    .eq("organization_id", organizationId)
    .not("extracted_text", "is", null)
    .order("updated_at", { ascending: false })
    .limit(MAX_INSTITUTIONAL_DOCUMENTS);

  if (error) {
    console.warn(
      "[governance/chat] Não foi possível carregar Base Institucional:",
      error,
    );

    return {
      contextText: "",
      matchedDocumentIds: [],
      matchedDocumentTitles: [],
      sources: [],
      warnings: ["Não foi possível consultar a Base Institucional."],
    };
  }

  const rows = ((data ?? []) as InstitutionalDocumentContextRow[]).filter(
    isInstitutionalDocumentAvailable,
  );

  const candidateDocuments = selectRelevantInstitutionalDocuments(rows, question);

  if (candidateDocuments.length === 0) {
    return {
      contextText: "",
      matchedDocumentIds: [],
      matchedDocumentTitles: [],
      sources: [],
      warnings: [],
    };
  }

  const selected: Array<{
    document: InstitutionalDocumentContextRow;
    documentScore: number;
    chunkIndex: number;
    text: string;
  }> = [];

  for (const candidate of candidateDocuments) {
    const document = candidate.document;
    const text = normalizePdfText(document.extracted_text ?? "");

    if (!text) {
      continue;
    }

    const chunks = chunkText(text, {
      chunkSize: 1400,
      overlap: 180,
      maxChunks: 250,
    });

    const relevantChunks = pickRelevantChunks(chunks, question, {
      maxChunks: candidate.score >= 120 ? 10 : 4,
      maxChars: candidate.score >= 120 ? 18000 : 7000,
      minScore: candidate.score >= 120 ? 0 : 1,
    });

    const chunksToUse =
      relevantChunks.length > 0
        ? relevantChunks
        : candidate.score >= 120
          ? chunks.slice(0, 2).map((chunk) => ({
              index: chunk.index,
              text: chunk.text,
              score: candidate.score,
            }))
          : [];

    for (const chunk of chunksToUse) {
      selected.push({
        document,
        documentScore: candidate.score,
        chunkIndex: chunk.index,
        text: clampText(chunk.text, candidate.score >= 120 ? 3500 : 2200),
      });
    }

    if (selected.length >= MAX_INSTITUTIONAL_SELECTED_CHUNKS) {
      break;
    }
  }

  if (selected.length === 0) {
    return {
      contextText: "",
      matchedDocumentIds: [],
      matchedDocumentTitles: [],
      sources: [],
      warnings: [],
    };
  }

  const selectedDocumentsById = new Map<string, InstitutionalDocumentContextRow>();

  for (const item of selected) {
    if (!selectedDocumentsById.has(item.document.id)) {
      selectedDocumentsById.set(item.document.id, item.document);
    }
  }

  const matchedDocumentIds = Array.from(selectedDocumentsById.keys());

  const matchedDocumentTitles = Array.from(selectedDocumentsById.values()).map(
    (document) =>
      String(document.title ?? "").trim() ||
      "Documento institucional sem título",
  );

  const sources = await Promise.all(
    Array.from(selectedDocumentsById.values()).map((document) =>
      buildInstitutionalSource(client, document),
    ),
  );

  let usedChars = 0;
  const blocks: string[] = [];

  for (const [index, item] of selected.entries()) {
    const title =
      String(item.document.title ?? "").trim() ||
      "Documento institucional sem título";

    const documentTypeLabel = getInstitutionalDocumentTypeLabel(
      item.document.document_type,
    );

    const sourceUrl = await resolveInstitutionalDocumentUrl(client, item.document);

    const block = [
      `[Base Institucional - Trecho ${index + 1}]`,
      `Documento: ${title}`,
      `Tipo: ${documentTypeLabel}`,
      `Relevância interna: ${item.documentScore}`,
      `document_id: ${item.document.id}`,
      `chunk_index: ${item.chunkIndex}`,
      sourceUrl ? `Link da fonte: ${sourceUrl}` : "",
      "",
      item.text,
    ]
      .filter(Boolean)
      .join("\n");

    if (usedChars + block.length > MAX_INSTITUTIONAL_CONTEXT_CHARS) {
      break;
    }

    blocks.push(block);
    usedChars += block.length;
  }

  if (blocks.length === 0) {
    return {
      contextText: "",
      matchedDocumentIds,
      matchedDocumentTitles,
      sources,
      warnings: [],
    };
  }

  const contextText = [
    "BASE INSTITUCIONAL DA ORGANIZAÇÃO",
    "",
    "Prioridade máxima: use estes trechos antes do Diário Oficial, das Fontes Oficiais e do conhecimento geral.",
    "Use somente os documentos institucionais listados nos trechos abaixo para responder sobre Base Institucional.",
    "Quando responder com base nestes trechos, mencione o documento institucional utilizado pelo título, sem criar link manual no corpo da resposta.",
    "Não inclua seção 'Base institucional' no texto da resposta; o sistema exibirá essa fonte de forma estruturada e clicável abaixo da resposta.",
    "Não misture documentos da Base Institucional com a seção 'Base legal'. Não use o termo 'Base legal' para documentos cadastrados; documentos cadastrados ficam exclusivamente nas referências estruturadas da interface.",
    "Não escreva frases como 'Não houve consulta web nesta resposta'. Se não houver referência oficial específica, simplesmente omita essa observação.",
    "Não invente conteúdo ausente. Se os trechos forem insuficientes, diga que a Base Institucional não trouxe informação suficiente.",
    "Nunca declare que um documento institucional recuperado está errado apenas com base em memória do modelo. Se o documento foi selecionado pelo sistema, trate-o como fonte institucional cadastrada.",
    "Não crie links no corpo da resposta. Cite o nome do documento em texto simples; o link oficial será exibido abaixo em 'Fontes consultadas'.",
    "",
    ...blocks,
  ].join("\n");

  return {
    contextText,
    matchedDocumentIds,
    matchedDocumentTitles,
    sources,
    warnings: [],
  };
}
