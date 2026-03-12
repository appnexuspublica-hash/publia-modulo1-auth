// src/lib/pdf/retrieveChunks.ts
import OpenAI from "openai";

const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

const DEFAULT_MATCH_COUNT = 6;
const DEFAULT_MIN_SIMILARITY = 0.45;

let openai: OpenAI | null = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export type RetrievedPdfChunk = {
  id: string;
  pdf_file_id: string;
  conversation_id: string | null;
  user_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

export async function embedPdfQuestion(question: string): Promise<number[]> {
  if (!openai) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const cleanQuestion = String(question ?? "").trim();
  if (!cleanQuestion) {
    throw new Error("Pergunta vazia");
  }

  const resp = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleanQuestion,
    encoding_format: "float",
  } as any);

  const embedding = (resp as any)?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || !embedding.length) {
    throw new Error("Falha ao gerar embedding da pergunta");
  }

  return embedding as number[];
}

export async function retrieveRelevantPdfChunks(params: {
  client: any;
  userId: string;
  pdfFileId: string;
  question: string;
  matchCount?: number;
  minSimilarity?: number;
}) {
  const {
    client,
    userId,
    pdfFileId,
    question,
    matchCount = DEFAULT_MATCH_COUNT,
    minSimilarity = DEFAULT_MIN_SIMILARITY,
  } = params;

  const queryEmbedding = await embedPdfQuestion(question);

  const { data, error } = await client.rpc("match_pdf_chunks", {
    query_embedding: queryEmbedding,
    match_pdf_file_id: pdfFileId,
    match_user_id: userId,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`Falha ao buscar chunks relevantes: ${error.message}`);
  }

  const rows = ((data ?? []) as RetrievedPdfChunk[])
    .map((row) => ({
      ...row,
      content: String(row?.content ?? "").trim(),
      similarity: Number(row?.similarity ?? 0),
      chunk_index: Number(row?.chunk_index ?? 0),
    }))
    .filter((row) => row.content.length > 0)
    .filter((row) => row.similarity >= minSimilarity);

  return rows;
}

export function buildPdfContext(chunks: RetrievedPdfChunk[]) {
  return chunks
    .map((chunk, index) =>
      [
        `[Trecho ${index + 1}]`,
        `chunk_index: ${chunk.chunk_index}`,
        `similaridade: ${chunk.similarity.toFixed(4)}`,
        chunk.content,
      ].join("\n")
    )
    .join("\n\n");
}