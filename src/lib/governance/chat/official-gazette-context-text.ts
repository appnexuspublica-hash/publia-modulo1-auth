import { clampText } from "@/lib/governance/chat/pdf-context";
import {
  getOfficialGazetteDocumentMetadata,
  type OfficialGazetteContextChunkRow,
} from "@/lib/governance/chat/official-gazette-metadata";
import { extractOfficialGazetteExactActReference } from "@/lib/governance/chat/official-gazette-query";
import {
  normalizeOfficialGazetteUrl,
  pickOfficialGazetteUrl,
} from "@/lib/governance/chat/official-gazette-urls";

const MAX_OFFICIAL_GAZETTE_CONTEXT_CHARS = 9000;
const MAX_OFFICIAL_GAZETTE_COMPLETE_LIST_CONTEXT_CHARS = 30000;

export function buildOfficialGazetteContextText(params: {
  chunks: OfficialGazetteContextChunkRow[];
  question: string;
  completeListMode?: boolean;
}) {
  const { chunks, question, completeListMode = false } = params;

  if (chunks.length === 0) {
    return "";
  }

  let totalChars = 0;
  const blocks: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const title = String(chunk.title ?? "Ato do Diário Oficial").trim();
    const sectionType = String(chunk.section_type ?? "não classificado").trim();
    const pageNumber =
      typeof chunk.page_number === "number" ? `Página ${chunk.page_number}` : "Página não informada";
    const content = clampText(String(chunk.content ?? "").trim(), completeListMode ? 420 : 1600);
    const { editionNumber, publicationDate, publicUrl, pdfUrl, sourcePageUrl } =
      getOfficialGazetteDocumentMetadata(chunk);
    const normalizedSourcePageUrl = normalizeOfficialGazetteUrl(
      sourcePageUrl,
      publicationDate,
    );
    const normalizedPublicUrl = normalizeOfficialGazetteUrl(publicUrl, publicationDate);
    const normalizedPdfUrl = normalizeOfficialGazetteUrl(pdfUrl, publicationDate);
    const officialUrl = pickOfficialGazetteUrl({
      sourcePageUrl,
      publicUrl,
      pdfUrl,
      publicationDate,
    });

    const officialLinks = [
      officialUrl ? `Link oficial para citar este ato: ${officialUrl}` : null,
      normalizedSourcePageUrl
        ? `Página oficial da edição: ${normalizedSourcePageUrl}`
        : null,
      normalizedPublicUrl ? `URL pública do documento: ${normalizedPublicUrl}` : null,
      normalizedPdfUrl ? `PDF oficial do Diário Oficial: ${normalizedPdfUrl}` : null,
    ].filter(Boolean);

    const block = [
      `ATO ${index + 1}`,
      `Título: ${title}`,
      `Tipo: ${sectionType}`,
      `Documento: ${chunk.document_id}`,
      editionNumber ? `Edição do Diário Oficial: ${editionNumber}` : null,
      publicationDate ? `Data de publicação: ${publicationDate}` : null,
      pageNumber,
      ...officialLinks,
      "",
      content,
    ]
      .filter((line): line is string => typeof line === "string")
      .join("\n");

    const maxContextChars = completeListMode
      ? MAX_OFFICIAL_GAZETTE_COMPLETE_LIST_CONTEXT_CHARS
      : MAX_OFFICIAL_GAZETTE_CONTEXT_CHARS;

    if (totalChars + block.length > maxContextChars) {
      break;
    }

    blocks.push(block);
    totalChars += block.length;
  }

  if (blocks.length === 0) {
    return "";
  }

  return [
    "CONTEXTO DO DIÁRIO OFICIAL MUNICIPAL",
    "",
    "Use os atos abaixo como base factual quando a pergunta envolver Diário Oficial, decretos, portarias, licitações, dispensas, resoluções, leis, editais, extratos ou atos publicados.",
    "Não invente ato não listado. Se os atos recuperados não forem suficientes, diga apenas que não localizou evidência suficiente nos atos indexados.",
    extractOfficialGazetteExactActReference(question)
      ? "A pergunta busca um ato exato. Responda de forma objetiva, em no máximo 3 frases: informe edição e data quando houver correspondência exata; se não houver, diga apenas que o ato não foi localizado nos documentos indexados. Não inclua fundamentação genérica, recomendações, cuidados ou passo a passo."
      : "",
    completeListMode
      ? "Quando a pergunta pedir contagem ou lista completa da edição, use exatamente o número informado em 'Atos recuperados'. Não reduza, não agrupe e não ignore blocos ATO. Cada bloco ATO representa um ato indexado."
      : "Quando a pergunta pedir contagem, conte apenas os atos recuperados neste contexto e informe que o número depende dos atos já indexados no sistema.",
    "Quando citar ato municipal recuperado deste contexto, transforme o próprio nome do ato em link Markdown usando o campo 'Link oficial para citar este ato'. Exemplo: [Decreto nº 042/2026](URL).",
    "Não coloque URL bruta isolada no final quando o nome do ato puder ser linkado no próprio texto.",
    "Use somente os links informados no próprio ato. Não crie link do Planalto para decreto, portaria, resolução, edital, dispensa, extrato ou outro ato municipal.",
    "Se o ato recuperado não trouxer link oficial, cite o ato em texto simples, sem hyperlink presumido.",
    "",
    `Pergunta do usuário: ${question}`,
    "",
    completeListMode
      ? `Atos recuperados: ${blocks.length} de ${chunks.length} atos indexados para o filtro solicitado`
      : `Atos recuperados: ${blocks.length}`,
    "",
    blocks.join("\n\n---\n\n"),
  ].join("\n");
}
