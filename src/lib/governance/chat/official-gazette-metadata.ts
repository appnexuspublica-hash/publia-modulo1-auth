export type OfficialGazetteContextChunkRow = {
  document_id: string;
  organization_id: string;
  page_number: number | null;
  section_type: string | null;
  title: string | null;
  content: string | null;
  governance_official_gazette_documents?:
    | {
        edition_number?: number | null;
        publication_date?: string | null;
        public_url?: string | null;
        pdf_url?: string | null;
        source_page_url?: string | null;
      }
    | {
        edition_number?: number | null;
        publication_date?: string | null;
        public_url?: string | null;
        pdf_url?: string | null;
        source_page_url?: string | null;
      }[];
};

export function getOfficialGazetteDocumentMetadata(
  chunk: OfficialGazetteContextChunkRow,
) {
  const relation = chunk.governance_official_gazette_documents;
  const documentMetadata = Array.isArray(relation) ? relation[0] : relation;

  return {
    editionNumber: documentMetadata?.edition_number ?? null,
    publicationDate: documentMetadata?.publication_date ?? null,
    publicUrl: String(documentMetadata?.public_url ?? "").trim(),
    pdfUrl: String(documentMetadata?.pdf_url ?? "").trim(),
    sourcePageUrl: String(documentMetadata?.source_page_url ?? "").trim(),
  };
}

export function compareOfficialGazetteRows(
  a: OfficialGazetteContextChunkRow,
  b: OfficialGazetteContextChunkRow,
) {
  const aPage =
    typeof a.page_number === "number" ? a.page_number : Number.MAX_SAFE_INTEGER;
  const bPage =
    typeof b.page_number === "number" ? b.page_number : Number.MAX_SAFE_INTEGER;

  if (aPage !== bPage) {
    return aPage - bPage;
  }

  return String(a.title ?? "").localeCompare(String(b.title ?? ""), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

export function getOfficialGazetteDocumentSortValue(
  rows: OfficialGazetteContextChunkRow[],
) {
  const firstRow = rows[0];

  if (!firstRow) {
    return 0;
  }

  const { editionNumber, publicationDate } =
    getOfficialGazetteDocumentMetadata(firstRow);
  const publicationTime = publicationDate
    ? Date.parse(`${publicationDate}T00:00:00Z`)
    : 0;
  const safePublicationTime = Number.isFinite(publicationTime)
    ? publicationTime
    : 0;

  return safePublicationTime + Number(editionNumber ?? 0);
}
