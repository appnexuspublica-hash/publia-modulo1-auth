// src/lib/governance/institutional-documents/chunk-index.ts

export type InstitutionalDocumentChunk = {
  document_id: string;
  organization_id: string;
  page: number | null;
  chunk_index: number;
  content: string;
  normalized_content: string;
  keywords: string[];
  status: "active" | "pending_review" | "archived";
};

const DEFAULT_CHUNK_SIZE = 1800;
const DEFAULT_OVERLAP = 250;
const MIN_CHUNK_LENGTH = 80;

const STOP_WORDS = new Set([
  "a", "ao", "aos", "aquela", "aquele", "aqueles", "as", "com", "como",
  "da", "das", "de", "do", "dos", "e", "ela", "ele", "em", "entre", "essa",
  "esse", "esta", "este", "foi", "ha", "isso", "isto", "ja", "mais", "mas",
  "na", "nas", "no", "nos", "o", "os", "ou", "para", "pela", "pelas",
  "pelo", "pelos", "por", "que", "se", "sem", "ser", "sua", "suas", "seu",
  "seus", "tambem", "um", "uma",
]);

export function normalizeInstitutionalContent(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°ª]/g, "")
    .replace(/[^\p{L}\p{N}\s/.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractKeywords(normalizedContent: string, limit = 24) {
  const frequencies = new Map<string, number>();

  for (const term of normalizedContent.split(/[^a-z0-9]+/i)) {
    if (term.length < 4 || STOP_WORDS.has(term) || /^\d+$/.test(term)) {
      continue;
    }

    frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  }

  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function findChunkEnd(text: string, start: number, targetEnd: number) {
  if (targetEnd >= text.length) return text.length;

  const searchStart = Math.max(start + Math.floor(DEFAULT_CHUNK_SIZE * 0.6), start);
  const candidates = [
    text.lastIndexOf("\n\n", targetEnd),
    text.lastIndexOf(". ", targetEnd),
    text.lastIndexOf("; ", targetEnd),
    text.lastIndexOf("\n", targetEnd),
  ].filter((position) => position >= searchStart);

  if (candidates.length === 0) return targetEnd;

  const best = Math.max(...candidates);
  return best + (text.startsWith("\n\n", best) ? 2 : 1);
}

export function buildInstitutionalDocumentChunks(params: {
  documentId: string;
  organizationId: string;
  extractedText: string;
  status?: InstitutionalDocumentChunk["status"];
  chunkSize?: number;
  overlap?: number;
}): InstitutionalDocumentChunk[] {
  const text = String(params.extractedText ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < MIN_CHUNK_LENGTH) return [];

  const chunkSize = Math.max(500, params.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const overlap = Math.min(
    Math.max(0, params.overlap ?? DEFAULT_OVERLAP),
    Math.floor(chunkSize / 3),
  );

  const chunks: InstitutionalDocumentChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const targetEnd = Math.min(text.length, start + chunkSize);
    const end = findChunkEnd(text, start, targetEnd);
    const content = text.slice(start, end).trim();

    if (content.length >= MIN_CHUNK_LENGTH) {
      const normalizedContent = normalizeInstitutionalContent(content);

      chunks.push({
        document_id: params.documentId,
        organization_id: params.organizationId,
        page: null,
        chunk_index: chunkIndex,
        content,
        normalized_content: normalizedContent,
        keywords: extractKeywords(normalizedContent),
        status: params.status ?? "pending_review",
      });

      chunkIndex += 1;
    }

    if (end >= text.length) break;

    const nextStart = Math.max(end - overlap, start + 1);
    start = nextStart;
  }

  return chunks;
}

export function institutionalChunkStatusFromReviewStatus(
  reviewStatus: unknown,
): InstitutionalDocumentChunk["status"] {
  const normalized = String(reviewStatus ?? "").trim().toLowerCase();

  if (normalized === "approved") return "active";
  if (normalized === "archived") return "archived";
  return "pending_review";
}
