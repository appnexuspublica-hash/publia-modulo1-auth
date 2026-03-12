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

function isSafeStoragePath(storagePath: string) {
  if (!storagePath) return false;
  if (storagePath.includes("..")) return false;
  if (storagePath.includes("\\")) return false;
  if (storagePath.startsWith("/")) return false;
  if (storagePath.length > 300) return false;

  const parts = storagePath.split("/").filter(Boolean);
  if (parts.length < 2) return false;

  return true;
}

function errToString(error: any) {
  if (!error) return "Erro desconhecido";
  if (typeof error === "string") return error;

  const msg = error?.message ? String(error.message) : "";
  const name = error?.name ? String(error.name) : "";
  const details = error?.details ? String(error.details) : "";
  const hint = error?.hint ? String(error.hint) : "";
  const code = error?.code ? String(error.code) : "";

  return [code, name, msg, details, hint].filter(Boolean).join(" | ") || "Erro desconhecido";
}

function errToDetail(error: any) {
  const msg = errToString(error);
  const stack = typeof error?.stack === "string" ? error.stack : "";
  return { msg, stack };
}

async function downloadPdfBuffer(client: any, storagePath: string): Promise<Buffer> {
  console.log("[processPdfForIndexing] downloadPdfBuffer:start", { storagePath });

  const { data: fileData, error } = await client.storage.from("pdf-files").download(storagePath);

  if (error || !fileData) {
    throw new Error(`Falha ao baixar PDF do Storage: ${error?.message ?? "download falhou"}`);
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  console.log("[processPdfForIndexing] downloadPdfBuffer:done", {
    storagePath,
    bytes: buf.length,
  });

  return buf;
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
  console.log("[processPdfForIndexing] start", {
    userId,
    pdfFileId,
    resetBeforeProcessing,
    isDev,
  });

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

  console.log("[processPdfForIndexing] pdf lookup", {
    found: !!pdf,
    pdfErr: pdfErr?.message ?? null,
  });

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

  const conversationId = ((pdf as any).conversation_id as string | null) ?? null;
  const storagePath = String((pdf as any).storage_path ?? "");
  const fileSize = Number((pdf as any).file_size ?? 0);

  console.log("[processPdfForIndexing] pdf meta", {
    fileName: (pdf as any).file_name ?? null,
    conversationId,
    storagePath,
    fileSize,
    extracted_text_status: (pdf as any).extracted_text_status ?? null,
    vector_index_status: (pdf as any).vector_index_status ?? null,
    extracted_text_len: String((pdf as any).extracted_text ?? "").length,
  });

  let extractedText = String((pdf as any).extracted_text ?? "");
  let extractedStatus = String((pdf as any).extracted_text_status ?? "").toLowerCase();

  if (resetBeforeProcessing) {
    console.log("[processPdfForIndexing] resetBeforeProcessing:resetting");

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

    // MUITO IMPORTANTE:
    // após resetar no banco, resetar também o estado em memória
    extractedText = "";
    extractedStatus = "pending";

    console.log("[processPdfForIndexing] resetBeforeProcessing:done");
  }

  const safeStoragePath = isSafeStoragePath(storagePath);

  console.log("[processPdfForIndexing] storagePath validation", {
    conversationId,
    storagePath,
    safeStoragePath,
  });

  if (!safeStoragePath) {
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

    console.log("[processPdfForIndexing] aborted: unsafe storage_path");

    return {
      status: 200,
      body: { ok: false, extracted_text_status: "error", vector_index_status: "blocked_no_text" },
    };
  }

  const maxBytes = PDF_EXTRACT_MAX_MB * 1024 * 1024;

  console.log("[processPdfForIndexing] size check", {
    fileSize,
    maxBytes,
    maxMb: PDF_EXTRACT_MAX_MB,
  });

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

    console.log("[processPdfForIndexing] aborted: skipped_large");

    return {
      status: 200,
      body: {
        ok: false,
        extracted_text_status: "skipped_large",
        vector_index_status: "blocked_no_text",
      },
    };
  }

  console.log("[processPdfForIndexing] extraction gate", {
    extractedStatus,
    extractedTextLen: extractedText.length,
    willExtract: extractedStatus !== "ready" || !extractedText.trim(),
  });

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

      console.log("[processPdfForIndexing] calling extractPdfTextFromBuffer", {
        bufferBytes: buf.length,
        hardLimit: EXTRACT_TEXT_HARD_LIMIT,
      });

      const extracted = await extractPdfTextFromBuffer(buf, {
        hardLimit: EXTRACT_TEXT_HARD_LIMIT,
        fileSizeBytes: fileSize,
        maxBytes,
        maxMbLabel: PDF_EXTRACT_MAX_MB,
      });

      console.log("[processPdfForIndexing] extract result", {
        kind: extracted.kind,
        ...(extracted.kind === "ready"
          ? {
              textLen: extracted.text.length,
              preview: extracted.text.slice(0, 200),
            }
          : extracted.kind === "technical_error" || extracted.kind === "skipped_large"
          ? { error: extracted.error }
          : {}),
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

        console.log("[processPdfForIndexing] extract result: no_text");

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

      console.log("[processPdfForIndexing] extracted text saved", {
        extractedTextLen: extractedText.length,
      });
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
    console.log("[processPdfForIndexing] abort after extraction gate", {
      extractedStatus,
      extractedTextLen: extractedText.length,
    });

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

    console.log("[processPdfForIndexing] chunkText result", {
      rawChunks: Array.isArray(chunks) ? chunks.length : 0,
      extractedTextLen: extractedText.length,
    });

    const chunkItems = (chunks ?? [])
      .map((c, i) => ({
        index: typeof c?.index === "number" ? c.index : i,
        text: String(c?.text ?? "").trim(),
      }))
      .filter((c) => c.text.length > 0);

    console.log("[processPdfForIndexing] chunkItems filtered", {
      count: chunkItems.length,
      firstPreview: chunkItems[0]?.text?.slice(0, 200) ?? null,
    });

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

      console.log("[processPdfForIndexing] embedding batch", {
        start,
        size: slice.length,
      });

      const vectors = await embedTexts(slice.map((s) => s.text));

      const rowsToInsert = slice.map((s, i) => ({
        pdf_file_id: pdfFileId,
        conversation_id: conversationId,
        user_id: userId,
        chunk_index: s.index,
        content: s.text,
        embedding: vectorLiteral(vectors[i]),
      }));

      console.log("[processPdfForIndexing] inserting batch", {
        start,
        rows: rowsToInsert.length,
        conversation_id: conversationId,
      });

      const { error: insErr } = await client.from("pdf_chunks").insert(rowsToInsert as any);
      if (insErr) {
        throw insErr;
      }
    }

    await client
      .from("pdf_files")
      .update({
        extracted_text_status: "ready",
        vector_index_status: "ready",
        vector_index_error: null,
        vector_chunks_count: chunkItems.length,
        vector_index_updated_at: nowIso(),
      } as any)
      .eq("id", pdfFileId)
      .eq("user_id", userId);

    console.log("[processPdfForIndexing] success", {
      pdfFileId,
      conversation_id: conversationId,
      vector_chunks_count: chunkItems.length,
      embeddingModel: EMBEDDING_MODEL,
    });

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