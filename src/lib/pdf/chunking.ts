// src/lib/pdf/chunking.ts

type Chunk = { text: string; index: number };

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(query: string) {
  const stop = new Set([
    "a","o","os","as","de","do","da","dos","das","e","em","no","na","nos","nas",
    "um","uma","uns","umas","para","por","com","sem","que","se","ao","à","às",
    "é","ser","como","mais","menos","ja","não","sim","sua","seu","suas","seus",
    "sobre","entre","ate","desde","quando","onde","qual","quais","quanto","quantos"
  ]);

  return normalize(query)
    .split(" ")
    .filter((t) => t.length >= 3 && !stop.has(t));
}

export function chunkText(
  text: string,
  opts?: { chunkSize?: number; overlap?: number; maxChunks?: number }
): Chunk[] {
  const chunkSize = opts?.chunkSize ?? 1400; // chars
  const overlap = opts?.overlap ?? 200;
  const maxChunks = opts?.maxChunks ?? 400;

  const clean = text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const chunks: Chunk[] = [];
  let i = 0;
  let idx = 0;

  while (i < clean.length && chunks.length < maxChunks) {
    const end = Math.min(i + chunkSize, clean.length);
    const slice = clean.slice(i, end).trim();
    if (slice) chunks.push({ text: slice, index: idx++ });

    if (end >= clean.length) break;
    i = Math.max(0, end - overlap);
  }

  return chunks;
}

function scoreChunk(chunkText: string, terms: string[]) {
  if (terms.length === 0) return 0;
  const hay = normalize(chunkText);
  let score = 0;
  for (const t of terms) if (hay.includes(t)) score += 1;
  return score;
}

export function pickRelevantChunks(
  chunks: Chunk[],
  userQuestion: string,
  opts?: { maxChunks?: number; maxChars?: number; minScore?: number }
) {
  const maxChunks = opts?.maxChunks ?? 6;
  const maxChars = opts?.maxChars ?? 9000;
  const minScore = opts?.minScore ?? 1;

  const terms = tokenize(userQuestion);
  const ranked = chunks
    .map((c) => ({ ...c, score: scoreChunk(c.text, terms) }))
    .sort((a, b) => b.score - a.score);

  const picked: Chunk[] = [];
  let used = 0;

  for (const r of ranked) {
    if (picked.length >= maxChunks) break;
    if (r.score < minScore) break;

    if (used + r.text.length > maxChars) continue;
    picked.push({ text: r.text, index: r.index });
    used += r.text.length;
  }

  // fallback: nada relevante -> começo do doc
  if (picked.length === 0 && chunks.length) {
    picked.push({
      text: chunks[0].text.slice(0, Math.min(chunks[0].text.length, maxChars)),
      index: 0,
    });
  }

  return picked;
}
