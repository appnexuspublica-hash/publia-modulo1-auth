import type { GovernanceChatSource } from "@/lib/governance/chat/references";

export type InstitutionalDocumentContextRow = {
  id: string;
  title: string | null;
  document_type: string | null;
  source_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  extracted_text: string | null;
  indexing_status: string | null;
  review_status: string | null;
  indexed_at: string | null;
  updated_at: string | null;
};

export type InstitutionalContextResult = {
  contextText: string;
  matchedDocumentIds: string[];
  matchedDocumentTitles: string[];
  sources: GovernanceChatSource[];
  warnings: string[];
};

export function isInstitutionalDocumentAvailable(
  row: InstitutionalDocumentContextRow,
) {
  const extractedText = String(row.extracted_text ?? "").trim();
  if (!extractedText) {
    return false;
  }

  const indexingStatus = String(row.indexing_status ?? "")
    .trim()
    .toLowerCase();

  if (
    indexingStatus &&
    ![
      "indexed",
      "indexado",
      "processed",
      "completed",
      "success",
      "ready",
    ].includes(indexingStatus)
  ) {
    return false;
  }

  const reviewStatus = String(row.review_status ?? "")
    .trim()
    .toLowerCase();

  if (reviewStatus !== "approved") {
    return false;
  }

  return true;
}

export function getInstitutionalDocumentTypeLabel(
  value: string | null | undefined,
) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  const labels: Record<string, string> = {
    ata: "Ata",
    codigo: "Código",
    contrato: "Contrato",
    decreto: "Decreto",
    decreto_consolidado: "Decreto",
    edital: "Edital",
    estatuto: "Estatuto",
    instrucao_normativa: "Instrução Normativa",
    lei: "Lei",
    lei_organica: "Lei",
    manual: "Manual",
    norma_interna: "Instrução Normativa",
    organograma: "Organograma",
    outro: "Outro",
    parecer: "Parecer Jurídico",
    parecer_juridico: "Parecer Jurídico",
    parecer_modelo: "Parecer Jurídico",
    plano: "Plano",
    portaria: "Portaria",
    recomendacoes_mp: "Recomendações do MP",
    regulamento: "Regulamento",
    resolucao: "Resolução",
  };

  return labels[normalized] ?? "Documento institucional";
}
