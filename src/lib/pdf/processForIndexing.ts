// src/lib/pdf/processForIndexing.ts
import OpenAI from "openai";

import { chunkText } from "@/lib/pdf/chunking";
import {
  DEFAULT_EXTRACT_TEXT_HARD_LIMIT,
  extractPdfTextFromBuffer,
  getNoTextPdfMessage,
  getSkippedLargePdfMessage,
} from "@/lib/pdf/extract";

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const EMBED_BATCH = 96;

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const CHUNK_MAX = 500;

const PDF_EXTRACT_MAX_MB = Number(process.env.PDF_EXTRACT_MAX_MB ?? 48);
const EXTRACT_TEXT_HARD_LIMIT = DEFAULT_EXTRACT_TEXT_HARD_LIMIT;

let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function nowIso() {
  return new Date().toISOString();
}

function vectorLiteral(v: number[]) {
  return `[${v.join(",")}]`;
}

async function embedTexts(texts: string[]) {
  if (!openai) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const resp = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    encoding_format: "float",
  } as any);

  const data = (resp as any)?.data ?? [];
  return data.map((d: any) => d.embedding) as number[][];
}

function isSafeStoragePath(conversationId: string | null, storagePath: string) {
  if (!conversationId) return false;
  if (!storagePath.startsWith(`${conversationId}/`)) return false;
  if (storagePath.includes("..")) return false;
  if (storagePath.includes("\\")) return false;
  if (storagePath.startsWith("/")) return false;
  if (storagePath.length > 300) return false;
  return true;
}

function errToString(error: any) {
  if (!error) return "Erro desconhecido";
  if (typeof error === "string") return error;

  const msg = error?.message ? String(error.message) : "";
  const name = error?.name ? String(error.name) : "";

  return [name, msg].filter(Boolean).join(": ") || "Erro desconhecido";
}

function errToDetail(error: any) {
  const msg = errToString(error);
  const stack = typeof error?.stack === "string" ? error.stack : "";
  return { msg, stack };
}

async function downloadPdfBuffer(client: any, storagePath: string): Promise<Buffer> {
  const { data: fileData, error } = await client.storage.from("pdf-files").download(storagePath);

  if (error || !fileData) {
    throw new Error(`Falha ao baixar PDF do Storage: ${error?.message ?? "download falhou"}`);
  }

  return Buffer.from(await fileData.arrayBuffer());
}

type ProcessPdfParams = {
  client: any;
  userId: string;
  pdfFileId: string;
  isDev?: boolean;
  resetBeforeProcessing?: boolean;
};

type ProcessPdfResult = {
  status: number;
  body: Record<string, any>;
};

export async function processPdfForIndexing({
  client,
  userId,
  pdfFileId,
  isDev = false,
  resetBeforeProcessing = false,
}: ProcessPdfParams): Promise<ProcessPdfResult> {
  if (!openai) {
    return {
      status: 500,
      body: { error: "OPENAI_API_KEY ausente. Não é possível indexar." },
    };
  }

  const { data: pdf, error: pdfErr } = await client
    .from("pdf_files")
    .select(
      "id, conversation_id, user_id, file_name, file_size, storage_path, extracted_text, extracted_text_status, extracted_text_error, vector_index_status, vector_index_error"
    )
    .eq("id", pdfFileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (pdfErr) {
    return {
      status: 500,
      body: { error: "Falha ao buscar pdf_files.", detail: pdfErr.message },
    };
  }

  if (!pdf) {
    return {
      status: 404,
      body: { error: "PDF não encontrado ou sem permissão." },
    };
  }

  const conversationId = (pdf as any).conversation_id as string | null;
  const storagePath = String((pdf as any).storage_path ?? "");
  const fileSize = Number((pdf as any).file_size ?? 0);

  if (resetBeforeProcessing) {
    await client
      .from("pdf_files")
      .update({
        extracted_text: null,
        extracted_text_status: "pending",
        extracted_text_error: null,
        extracted_text_updated_at: nowIso(),
        vector_index_status: "pending",
        vector_index_error: null,
        vector_chunks_count: 0,
        vector_index_updated_at: nowIso(),
      } as any)
      .eq("id", pdfFileId)
      .eq("user_id", userId);

    await client.from("pdf_chunks").delete().eq("pdf_file_id", pdfFileId).eq("user_id", userId);
  }

  if (!isSafeStoragePath(conversationId, storagePath)) {
    await client
      .from("pdf_files")
      .update({
        extracted_text_status: "error",
        extracted_text_error: "storage_path inválido para processamento.",
        extracted_text: null,
        extracted_text_updated_at: nowIso(),
        vector_index_status: "blocked_no_text",
        vector_index_error: "Sem texto (storage_path inválido).",
        vector_chunks_count: 0,
        vector_index_updated_at: nowIso(),
      } as any)
      .eq("id", pdfFileId)
      .eq("user_id", userId);

    return {
      status: 200,
      body: { ok: false, extracted_text_status: "error", vector_index_status: "blocked_no_text" },
    };
  }

  const maxBytes = PDF_EXTRACT_MAX_MB * 1024 * 1024;
  if (fileSize > 0 && fileSize > maxBytes) {
    const msg = getSkippedLargePdfMessage(PDF_EXTRACT_MAX_MB);

    await client
      .from("pdf_files")
      .update({
        extracted_text_status: "skipped_large",
        extracted_text_error: msg,
        extracted_text_updated_at: nowIso(),
        vector_index_status: "blocked_no_text",
        vector_index_error: "Extração pulada (PDF grande).",
        vector_chunks_count: 0,
        vector_index_updated_at: nowIso(),
      } as any)
      .eq("id", pdfFileId)
      .eq("user_id", userId);

    return {
      status: 200,
      body: {
        ok: false,
        extracted_text_status: "skipped_large",
        vector_index_status: "blocked_no_text",
      },
    };
  }

  let extractedText = String((pdf as any).extracted_text ?? "");
  let extractedStatus = String((pdf as any).extracted_text_status ?? "").toLowerCase();

  if (extractedStatus !== "ready" || !extractedText.trim()) {
    await client
      .from("pdf_files")
      .update({
        extracted_text_status: "processing",
        extracted_text_error: null,
        extracted_text_updated_at: nowIso(),
      } as any)
      .eq("id", pdfFileId)
      .eq("user_id", userId);

    try {
      const buf = await downloadPdfBuffer(client, storagePath);

      const extracted = await extractPdfTextFromBuffer(buf, {
        hardLimit: EXTRACT_TEXT_HARD_LIMIT,
        fileSizeBytes: fileSize,
        maxBytes,
        maxMbLabel: PDF_EXTRACT_MAX_MB,
      });

      if (extracted.kind === "skipped_large") {
        await client
          .from("pdf_files")
          .update({
            extracted_text_status: "skipped_large",
            extracted_text_error: extracted.error,
            extracted_text_updated_at: nowIso(),
            vector_index_status: "blocked_no_text",
            vector_index_error: "Extração pulada (PDF grande).",
            vector_chunks_count: 0,
            vector_index_updated_at: nowIso(),
          } as any)
          .eq("id", pdfFileId)
          .eq("user_id", userId);

        return {
          status: 200,
          body: {
            ok: false,
            extracted_text_status: "skipped_large",
            vector_index_status: "blocked_no_text",
          },
        };
      }

      if (extracted.kind === "technical_error") {
        console.error("[processPdfForIndexing] technical_error:", extracted.error);

        await client
          .from("pdf_files")
          .update({
            extracted_text_status: "error",
            extracted_text_error: `Falha técnica ao extrair texto do PDF: ${extracted.error}`,
            extracted_text_updated_at: nowIso(),
            vector_index_status: "error",
            vector_index_error: `Falha na extração antes da indexação: ${extracted.error}`,
            vector_index_updated_at: nowIso(),
          } as any)
          .eq("id", pdfFileId)
          .eq("user_id", userId);

        return {
          status: 500,
          body: {
            error: "Falha ao extrair texto do PDF.",
            detail: extracted.error,
          },
        };
      }

      if (extracted.kind === "no_text") {
        const msg = getNoTextPdfMessage();

        await client
          .from("pdf_files")
          .update({
            extracted_text_status: "error",
            extracted_text_error: msg,
            extracted_text: null,
            extracted_text_updated_at: nowIso(),
            vector_index_status: "blocked_no_text",
            vector_index_error: "Sem texto detectável para indexação.",
            vector_chunks_count: 0,
            vector_index_updated_at: nowIso(),
          } as any)
          .eq("id", pdfFileId)
          .eq("user_id", userId);

        return {
          status: 200,
          body: {
            ok: false,
            extracted_text_status: "error",
            vector_index_status: "blocked_no_text",
          },
        };
      }

      extractedText = extracted.text;
      extractedStatus = "ready";

      await client
        .from("pdf_files")
        .update({
          extracted_text_status: "ready",
          extracted_text_error: null,
          extracted_text: extractedText,
          extracted_text_updated_at: nowIso(),
        } as any)
        .eq("id", pdfFileId)
        .eq("user_id", userId);
    } catch (error: any) {
      const { msg, stack } = errToDetail(error);
      console.error("[processPdfForIndexing] Falha na extração:", msg);
      if (stack) console.error(stack);

      await client
        .from("pdf_files")
        .update({
          extracted_text_status: "error",
          extracted_text_error: `Falha técnica ao extrair texto do PDF: ${msg}`,
          extracted_text_updated_at: nowIso(),
          vector_index_status: "error",
          vector_index_error: `Falha na extração antes da indexação: ${msg}`,
          vector_index_updated_at: nowIso(),
        } as any)
        .eq("id", pdfFileId)
        .eq("user_id", userId);

      return {
        status: 500,
        body: {
          error: "Falha ao extrair texto do PDF.",
          detail: msg,
          ...(isDev ? { stack } : {}),
        },
      };
    }
  }

  if (extractedStatus !== "ready" || !extractedText.trim()) {
    return {
      status: 409,
      body: {
        error: "PDF sem texto extraído. Não é possível indexar.",
        extracted_text_status: extractedStatus,
      },
    };
  }

  await client
    .from("pdf_files")
    .update({
      vector_index_status: "processing",
      vector_index_error: null,
      vector_index_updated_at: nowIso(),
    } as any)
    .eq("id", pdfFileId)
    .eq("user_id", userId);

  try {
    await client.from("pdf_chunks").delete().eq("pdf_file_id", pdfFileId).eq("user_id", userId);

    const chunks = chunkText(extractedText, {
      chunkSize: CHUNK_SIZE,
      overlap: CHUNK_OVERLAP,
      maxChunks: CHUNK_MAX,
    }) as any[];

    const chunkItems = (chunks ?? [])
      .map((c, i) => ({
        index: typeof c?.index === "number" ? c.index : i,
        text: String(c?.text ?? "").trim(),
      }))
      .filter((c) => c.text.length > 0);

    if (!chunkItems.length) {
      await client
        .from("pdf_files")
        .update({
          vector_index_status: "blocked_no_text",
          vector_index_error: "Texto insuficiente para criar chunks.",
          vector_chunks_count: 0,
          vector_index_updated_at: nowIso(),
        } as any)
        .eq("id", pdfFileId)
        .eq("user_id", userId);

      return {
        status: 200,
        body: { ok: false, vector_index_status: "blocked_no_text" },
      };
    }

    for (let start = 0; start < chunkItems.length; start += EMBED_BATCH) {
      const slice = chunkItems.slice(start, start + EMBED_BATCH);
      const vectors = await embedTexts(slice.map((s) => s.text));

      const rowsToInsert = slice.map((s, i) => ({
        pdf_file_id: pdfFileId,
        conversation_id: conversationId,
        user_id: userId,
        chunk_index: s.index,
        content: s.text,
        embedding: vectorLiteral(vectors[i]),
      }));

      const { error: insErr } = await client.from("pdf_chunks").insert(rowsToInsert as any);
      if (insErr) {
        throw insErr;
      }
    }

    await client
      .from("pdf_files")
      .update({
        vector_index_status: "ready",
        vector_index_error: null,
        vector_chunks_count: chunkItems.length,
        vector_index_updated_at: nowIso(),
      } as any)
      .eq("id", pdfFileId)
      .eq("user_id", userId);

    return {
      status: 200,
      body: {
        ok: true,
        pdfFileId,
        extracted_text_status: "ready",
        vector_index_status: "ready",
        vector_chunks_count: chunkItems.length,
        embeddingModel: EMBEDDING_MODEL,
      },
    };
  } catch (error: any) {
    const { msg, stack } = errToDetail(error);
    console.error("[processPdfForIndexing] Falha na indexação:", msg);
    if (stack) console.error(stack);

    await client
      .from("pdf_files")
      .update({
        vector_index_status: "error",
        vector_index_error: msg,
        vector_index_updated_at: nowIso(),
      } as any)
      .eq("id", pdfFileId)
      .eq("user_id", userId);

    return {
      status: 500,
      body: {
        error: "Falha ao indexar embeddings.",
        detail: msg,
        ...(isDev ? { stack } : {}),
      },
    };
  }
}