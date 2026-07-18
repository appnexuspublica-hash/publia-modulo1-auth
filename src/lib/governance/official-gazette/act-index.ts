// src/lib/governance/official-gazette/act-index.ts

export type OfficialGazetteActIndexDraft = {
  act_type: string;
  act_number: string | null;
  act_year: number | null;
  edition_number: string | null;
  publication_date: string | null;
  page_number: number | null;
  title: string;
  content: string;
  normalized_content: string;
  document_id: string;
  chunk_id: string;
};

type BuildOfficialGazetteActIndexParams = {
  chunks: Array<{
    id: string;
    page_number: number | null;
    section_type: string | null;
    title: string | null;
    content: string | null;
  }>;
  documentId: string;
  editionNumber: string | null;
  publicationDate: string | null;
};

function removeDiacritics(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeOfficialGazetteSearchText(value: string) {
  return removeDiacritics(value)
    .toLowerCase()
    .replace(/[º°]/g, "o")
    .replace(/\bn\s*[o0.]?\s*(?=\d)/g, " n ")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s*([/-])\s*/g, "$1")
    .replace(/[^a-z0-9/.\-\n ]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeActNumber(value: string) {
  const numeric = String(value ?? "").replace(/\D/g, "");
  if (!numeric) return null;

  const parsed = Number.parseInt(numeric, 10);
  return Number.isFinite(parsed) ? String(parsed) : null;
}

function normalizeYear(value: string | undefined, publicationDate: string | null) {
  if (value) {
    const year = Number.parseInt(value.length === 2 ? `20${value}` : value, 10);
    if (Number.isFinite(year) && year >= 1900 && year <= 2200) return year;
  }

  const fallback = publicationDate?.match(/^(\d{4})-/)?.[1];
  return fallback ? Number.parseInt(fallback, 10) : null;
}

function extractStructuredReference(params: {
  title: string;
  content: string;
  sectionType: string | null;
  publicationDate: string | null;
}) {
  const searchable = normalizeOfficialGazetteSearchText(
    `${params.title}\n${params.content.slice(0, 1600)}`,
  );

  const patterns: Array<{ type: string; regex: RegExp }> = [
    { type: "decreto", regex: /\bdecreto(?: municipal)?\s+(?:n\s*)?0*(\d{1,8})(?:[./-](\d{2,4}))?\b/i },
    { type: "portaria", regex: /\bportaria\s+(?:n\s*)?0*(\d{1,8})(?:[./-](\d{2,4}))?\b/i },
    { type: "resolucao", regex: /\bresolucao\s+(?:n\s*)?0*(\d{1,8})(?:[./-](\d{2,4}))?\b/i },
    { type: "lei", regex: /\blei(?: municipal)?\s+(?:n\s*)?0*(\d{1,8})(?:[./-](\d{2,4}))?\b/i },
    { type: "edital", regex: /\bedital\s+(?:n\s*)?0*(\d{1,8})(?:[./-](\d{2,4}))?\b/i },
    { type: "contrato", regex: /\b(?:contrato|termo|ata)\s+(?:n\s*)?0*(\d{1,8})(?:[./-](\d{2,4}))?\b/i },
    { type: "licitacao", regex: /\b(?:dispensa|inexigibilidade)(?: de licitacao)?\s+(?:n\s*)?0*(\d{1,8})(?:[./-](\d{2,4}))?\b/i },
  ];

  for (const candidate of patterns) {
    const match = searchable.match(candidate.regex);
    if (!match) continue;

    return {
      actType: candidate.type,
      actNumber: normalizeActNumber(match[1]),
      actYear: normalizeYear(match[2], params.publicationDate),
    };
  }

  const fallbackType = normalizeOfficialGazetteSearchText(params.sectionType ?? "")
    .replace(/\s+/g, "_");

  return {
    actType: fallbackType || "outro",
    actNumber: null,
    actYear: normalizeYear(undefined, params.publicationDate),
  };
}

export function buildOfficialGazetteActIndex(
  params: BuildOfficialGazetteActIndexParams,
): OfficialGazetteActIndexDraft[] {
  return params.chunks
    .filter((chunk) => String(chunk.content ?? "").trim().length > 0)
    .map((chunk) => {
      const title = String(chunk.title ?? "Ato do Diário Oficial").trim();
      const content = String(chunk.content ?? "").trim();
      const reference = extractStructuredReference({
        title,
        content,
        sectionType: chunk.section_type,
        publicationDate: params.publicationDate,
      });

      return {
        act_type: reference.actType,
        act_number: reference.actNumber,
        act_year: reference.actYear,
        edition_number: params.editionNumber,
        publication_date: params.publicationDate,
        page_number: chunk.page_number,
        title,
        content,
        normalized_content: normalizeOfficialGazetteSearchText(content),
        document_id: params.documentId,
        chunk_id: chunk.id,
      };
    });
}
