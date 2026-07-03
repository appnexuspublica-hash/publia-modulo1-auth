// src/lib/pdf/chunking.ts

export type TextChunk = {
  index: number;
  text: string;
};

type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
  maxChunks?: number;
};

type PickOptions = {
  maxChunks?: number;
  maxChars?: number;
  minScore?: number;
};

function normalizeForSearch(text: string) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  return normalizeForSearch(text)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const chunkSize = Math.max(300, options.chunkSize ?? 1200);
  const overlap = Math.max(0, options.overlap ?? 200);
  const maxChunks = Math.max(1, options.maxChunks ?? 200);

  const source = String(text ?? "").trim();
  if (!source) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < source.length && chunks.length < maxChunks) {
    let end = Math.min(source.length, start + chunkSize);

    if (end < source.length) {
      const lastParagraphBreak = source.lastIndexOf("\n\n", end);
      const lastSentenceBreak = source.lastIndexOf(". ", end);
      const lastSpace = source.lastIndexOf(" ", end);

      const bestBreak = Math.max(lastParagraphBreak, lastSentenceBreak, lastSpace);

      if (bestBreak > start + Math.floor(chunkSize * 0.6)) {
        end = bestBreak;
      }
    }

    const piece = source.slice(start, end).trim();
    if (piece) {
      chunks.push({ index, text: piece });
      index += 1;
    }

    if (end >= source.length) break;

    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

export function pickRelevantChunks(
  chunks: TextChunk[],
  query: string,
  options: PickOptions = {}
): TextChunk[] {
  const maxChunks = Math.max(1, options.maxChunks ?? 5);
  const maxChars = Math.max(500, options.maxChars ?? 6000);
  const minScore = options.minScore ?? 1;

  const queryTokens = tokenize(query);
  if (!chunks.length) return [];

  const scored = chunks
    .map((chunk) => {
      const chunkNorm = normalizeForSearch(chunk.text);

      let score = 0;
      for (const token of queryTokens) {
        if (chunkNorm.includes(token)) score += 1;
      }

      return { ...chunk, score };
    })
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const result: TextChunk[] = [];
  let usedChars = 0;

  for (const item of scored) {
    if (result.length >= maxChunks) break;
    if (usedChars + item.text.length > maxChars) break;

    result.push({ index: item.index, text: item.text });
    usedChars += item.text.length;
  }

  return result;
}