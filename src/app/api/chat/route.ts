// src/app/api/chat/route.ts
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

import { publiaPrompt } from "@/lib/publiaPrompt";
import { chunkText, pickRelevantChunks } from "@/lib/pdf/chunking";
import { getAccessSummary, syncEffectiveAccessStatus } from "@/lib/access-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- Supabase & OpenAI ----
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const RAG_TOP_K = Math.max(2, Math.min(10, Number(process.env.RAG_TOP_K ?? 4)));

const OPENAI_MODEL_WITH_PDF = process.env.OPENAI_MODEL_WITH_PDF || "gpt-5.1";
const OPENAI_MODEL_NO_PDF = process.env.OPENAI_MODEL_NO_PDF || "gpt-5.1";

const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

let openai: OpenAI | null = null;

if (!openaiApiKey) {
  console.error("[/api/chat] OPENAI_API_KEY não está definida.");
} else {
  openai = new OpenAI({ apiKey: openaiApiKey });
}

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type PdfFileRow = {
  id: string;
  conversation_id: string | null;
  user_id: string;
  file_name: string | null;
  storage_path: string;
  openai_file_id: string | null;
  file_size: number | null;
  created_at: string;
  extracted_text: string | null;
  extracted_text_status: string | null;
  extracted_text_error: string | null;
  vector_index_status: string | null;
  vector_index_error: string | null;
  vector_chunks_count: number | null;
};

type ConversationPdfState = {
  pdf_enabled: boolean;
  active_pdf_file_id: string | null;
};

type PdfChatState =
  | {
      kind: "none";
      pdfRow: null;
      pdfContext: "";
      openaiFileId: null;
      userError: null;
      ocrSuggested: false;
    }
  | {
      kind: "ready_context";
      pdfRow: PdfFileRow;
      pdfContext: string;
      openaiFileId: null;
      userError: null;
      ocrSuggested: false;
    }
  | {
      kind: "ready_file";
      pdfRow: PdfFileRow;
      pdfContext: "";
      openaiFileId: string;
      userError: null;
      ocrSuggested: false;
    }
  | {
      kind: "processing";
      pdfRow: PdfFileRow;
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: false;
    }
  | {
      kind: "no_text";
      pdfRow: PdfFileRow;
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: true;
    }
  | {
      kind: "error";
      pdfRow: PdfFileRow;
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: false;
    }
  | {
      kind: "skipped_large";
      pdfRow: PdfFileRow;
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: false;
    };

// --------------------
// LIMITES
// --------------------
const MAX_HISTORY = 4;
const MAX_PDF_CONTEXT_CHARS = 6000;
const MAX_TOTAL_CHARS = 10000;
const MAX_EXTRACTED_TEXT_CHARS = 150000;
const MAX_FULL_FILE_FALLBACK_MB = 20;

const OCR_URL = "https://smallpdf.com/pt/pdf-ocr";
const PDF_PROCESSING_MESSAGE =
  "O PDF anexado ainda está sendo processado. Aguarde alguns instantes e tente novamente.";
const PDF_TECHNICAL_MESSAGE =
  "O PDF foi anexado, mas houve uma falha técnica no processamento. Tente reprocessar ou reenviar o arquivo.";
const PDF_NO_TEXT_MESSAGE =
  "Infelizmente não consigo acessar o PDF. Faça OCR e reenvie. Use o botão FAZER OCR abaixo para abrir aplicativo.";
const PDF_LARGE_MESSAGE =
  "O PDF é grande demais para processamento automático neste momento. Envie uma versão menor ou reprocessada.";

function parseCookieHeader(cookieHeader: string | null) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;

  for (const part of cookieHeader.split(";")) {
    const p = part.trim();
    if (!p) continue;

    const eq = p.indexOf("=");
    if (eq === -1) continue;

    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    out[k] = decodeURIComponent(v);
  }

  return out;
}

function createAuthClient(req: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase anon envs faltando");
  }

  const jar = parseCookieHeader(req.headers.get("cookie"));

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name) => jar[name],
      set() {},
      remove() {},
    },
  });
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function parseTemperature(input: unknown, fallback = 0.3) {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(2, n));
}

function formatAssistantText(text: string) {
  return String(text || "").trim();
}

function shouldForceWebFirst(text: string) {
  const t = String(text || "").toLowerCase();

  const keywords = [
    "prazo",
    "limite",
    "valor",
    "multa",
    "lei",
    "decreto",
    "portaria",
    "tce",
    "tcm",
    "instrução normativa",
    "resolução",
    "vigente",
    "atualizado",
  ];

  return keywords.some((k) => t.includes(k));
}

function clampText(value: string, max: number) {
  const text = String(value ?? "");
  return text.length <= max ? text : text.slice(0, max);
}

function normalizeText(raw: string) {
  let text = String(raw ?? "");
  text = text.replace(/\u0000/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]{2,}/g, " ");
  return text.trim();
}

async function getConversationPdfState(
  client: any,
  conversationId: string,
  userId: string
): Promise<ConversationPdfState> {
  const { data, error } = await client
    .from("conversations")
    .select("pdf_enabled, active_pdf_file_id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { pdf_enabled: false, active_pdf_file_id: null };
  }

  return {
    pdf_enabled: (data as any).pdf_enabled !== false,
    active_pdf_file_id: ((data as any).active_pdf_file_id as string | null) ?? null,
  };
}

async function getPdfForConversation(
  client: any,
  conversationId: string,
  userId: string,
  state: ConversationPdfState
) {
  if (!state.pdf_enabled) return null;

  if (state.active_pdf_file_id) {
    const { data } = await client
      .from("pdf_files")
      .select(
        "id, conversation_id, user_id, file_name, storage_path, openai_file_id, file_size, created_at, extracted_text, extracted_text_status, extracted_text_error, vector_index_status, vector_index_error, vector_chunks_count"
      )
      .eq("id", state.active_pdf_file_id)
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return null;
    if (!data.storage_path || String(data.storage_path).includes("..")) return null;

    return data as PdfFileRow;
  }

  const { data: latest } = await client
    .from("pdf_files")
    .select(
      "id, conversation_id, user_id, file_name, storage_path, openai_file_id, file_size, created_at, extracted_text, extracted_text_status, extracted_text_error, vector_index_status, vector_index_error, vector_chunks_count"
    )
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return null;
  if (!latest.storage_path || String(latest.storage_path).includes("..")) return null;

  client
    .from("conversations")
    .update({ active_pdf_file_id: latest.id, pdf_enabled: true } as any)
    .eq("id", conversationId)
    .eq("user_id", userId)
    .then(() => {});

  return latest as PdfFileRow;
}

async function getQueryEmbedding(query: string): Promise<number[] | null> {
  if (!openai) return null;

  try {
    const resp = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
      encoding_format: "float",
    } as any);

    const emb = (resp as any)?.data?.[0]?.embedding;
    return Array.isArray(emb) ? emb : null;
  } catch {
    return null;
  }
}

async function uploadPdfToOpenAI(client: any, pdfRow: PdfFileRow): Promise<string | null> {
  if (!openai) return null;

  const { data: fileData, error: downloadError } = await client.storage
    .from("pdf-files")
    .download(pdfRow.storage_path);

  if (downloadError || !fileData) return null;

  try {
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const filename = pdfRow.file_name || "documento.pdf";
    const fileForOpenAI = await toFile(buffer, filename, { type: "application/pdf" });

    const uploaded = await openai.files.create({
      file: fileForOpenAI,
      purpose: "user_data",
    });

    return uploaded.id;
  } catch {
    return null;
  }
}

function isNoTextPdfError(errorText: string | null | undefined) {
  const msg = String(errorText ?? "").toLowerCase();

  return (
    msg.includes("sem texto detectável") ||
    msg.includes("sem texto detectavel") ||
    msg.includes("faça ocr e reenvie") ||
    msg.includes("imagem/escaneado") ||
    msg.includes("sem texto detectável para indexação") ||
    msg.includes("sem texto detectavel para indexação")
  );
}

async function buildPdfContextFromExtractedText(pdfRow: PdfFileRow, message: string) {
  if (String(pdfRow.extracted_text_status ?? "").toLowerCase() !== "ready") return "";
  if (!pdfRow.extracted_text) return "";

  const text = clampText(normalizeText(pdfRow.extracted_text), MAX_EXTRACTED_TEXT_CHARS);

  const chunks = chunkText(text, {
    chunkSize: 1200,
    overlap: 200,
    maxChunks: 320,
  });

  const picked = pickRelevantChunks(chunks, message, {
    maxChunks: 5,
    maxChars: MAX_PDF_CONTEXT_CHARS,
    minScore: 1,
  });

  if (!picked.length) return "";

  const raw = picked
    .map((c, i) => `Trecho ${i + 1} (chunk #${c.index}):\n${c.text}`)
    .join("\n\n---\n\n");

  return clampText(raw, MAX_PDF_CONTEXT_CHARS);
}

async function buildPdfContextFromVector(
  client: any,
  pdfRow: PdfFileRow,
  message: string
): Promise<string> {
  const vectorReady =
    String(pdfRow.vector_index_status ?? "").toLowerCase() === "ready" &&
    (pdfRow.vector_chunks_count ?? 0) > 0;

  if (!vectorReady) return "";

  const qEmb = await getQueryEmbedding(message);
  if (!qEmb) return "";

  const { data: matches, error: matchErr } = await client.rpc("match_pdf_chunks", {
    query_embedding: qEmb,
    match_count: RAG_TOP_K,
    filter_pdf_file_id: pdfRow.id,
  });

  if (matchErr || !Array.isArray(matches) || !matches.length) return "";

  const raw = matches
    .map(
      (m: any, i: number) => `Trecho ${i + 1} (chunk #${m.chunk_index}):\n${m.content}`
    )
    .join("\n\n---\n\n");

  return clampText(raw, MAX_PDF_CONTEXT_CHARS);
}

async function resolvePdfChatState(
  client: any,
  pdfRow: PdfFileRow | null,
  userId: string,
  message: string
): Promise<PdfChatState> {
  if (!pdfRow) {
    return {
      kind: "none",
      pdfRow: null,
      pdfContext: "",
      openaiFileId: null,
      userError: null,
      ocrSuggested: false,
    };
  }

  const extractedStatus = String(pdfRow.extracted_text_status ?? "").toLowerCase();
  const vectorStatus = String(pdfRow.vector_index_status ?? "").toLowerCase();

  const vectorContext = await buildPdfContextFromVector(client, pdfRow, message);
  if (vectorContext) {
    return {
      kind: "ready_context",
      pdfRow,
      pdfContext: vectorContext,
      openaiFileId: null,
      userError: null,
      ocrSuggested: false,
    };
  }

  const extractedContext = await buildPdfContextFromExtractedText(pdfRow, message);
  if (extractedContext) {
    return {
      kind: "ready_context",
      pdfRow,
      pdfContext: extractedContext,
      openaiFileId: null,
      userError: null,
      ocrSuggested: false,
    };
  }

  if (extractedStatus === "pending" || extractedStatus === "processing") {
    return {
      kind: "processing",
      pdfRow,
      pdfContext: "",
      openaiFileId: null,
      userError: PDF_PROCESSING_MESSAGE,
      ocrSuggested: false,
    };
  }

  if (extractedStatus === "error") {
    if (isNoTextPdfError(pdfRow.extracted_text_error)) {
      return {
        kind: "no_text",
        pdfRow,
        pdfContext: "",
        openaiFileId: null,
        userError: PDF_NO_TEXT_MESSAGE,
        ocrSuggested: true,
      };
    }

    return {
      kind: "error",
      pdfRow,
      pdfContext: "",
      openaiFileId: null,
      userError: PDF_TECHNICAL_MESSAGE,
      ocrSuggested: false,
    };
  }

  if (extractedStatus === "skipped_large") {
    return {
      kind: "skipped_large",
      pdfRow,
      pdfContext: "",
      openaiFileId: null,
      userError: PDF_LARGE_MESSAGE,
      ocrSuggested: false,
    };
  }

  if (extractedStatus === "ready" && vectorStatus !== "ready") {
    const sizeMb = (pdfRow.file_size ?? 0) / (1024 * 1024);
    const allowFullFile = sizeMb > 0 && sizeMb <= MAX_FULL_FILE_FALLBACK_MB;

    if (allowFullFile) {
      let openaiFileId = pdfRow.openai_file_id ?? null;

      if (!openaiFileId) {
        const uploadedId = await uploadPdfToOpenAI(client, pdfRow);
        if (uploadedId) {
          openaiFileId = uploadedId;

          await client
            .from("pdf_files")
            .update({ openai_file_id: uploadedId } as any)
            .eq("id", pdfRow.id)
            .eq("user_id", userId);
        }
      }

      if (openaiFileId) {
        return {
          kind: "ready_file",
          pdfRow,
          pdfContext: "",
          openaiFileId,
          userError: null,
          ocrSuggested: false,
        };
      }
    }
  }

  return {
    kind: "error",
    pdfRow,
    pdfContext: "",
    openaiFileId: null,
    userError: PDF_TECHNICAL_MESSAGE,
    ocrSuggested: false,
  };
}

async function registerUsageEvent(
  client: any,
  params: {
    userId: string;
    conversationId: string;
    eventType: "chat_message" | "pdf_question";
    inputTokens?: number;
    outputTokens?: number;
    metadata?: Record<string, any>;
  }
) {
  const {
    userId,
    conversationId,
    eventType,
    inputTokens = 0,
    outputTokens = 0,
    metadata = {},
  } = params;

  const { error } = await client.from("usage_events").insert({
    user_id: userId,
    event_type: eventType,
    conversation_id: conversationId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    metadata,
  });

  if (error) {
    console.error("[/api/chat] erro ao registrar usage_events", error);
  }
}

export async function POST(req: Request) {
  if (!openai || !supabaseUrl || !supabaseAnonKey) {
    return new Response(sseEvent("error", { error: "Servidor incompleto. Verifique envs." }), {
      status: 500,
      headers: SSE_HEADERS,
    });
  }

  const client = createAuthClient(req) as any;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(sseEvent("error", { error: "Corpo inválido. JSON era esperado." }), {
      status: 400,
      headers: SSE_HEADERS,
    });
  }

  const { conversationId, message, temperature } = body as {
    conversationId: string;
    message: string;
    temperature?: number;
  };

  const temp = parseTemperature(temperature, 0.3);

  if (!conversationId) {
    return new Response(sseEvent("error", { error: "conversationId é obrigatório." }), {
      status: 400,
      headers: SSE_HEADERS,
    });
  }

  if (!message?.trim()) {
    return new Response(sseEvent("error", { error: "Mensagem vazia." }), {
      status: 400,
      headers: SSE_HEADERS,
    });
  }

  const { data: authData } = await client.auth.getUser();
  if (!authData?.user) {
    return new Response(sseEvent("error", { error: "Não autenticado." }), {
      status: 401,
      headers: SSE_HEADERS,
    });
  }

  const userId = authData.user.id;

  const accessSummary = await getAccessSummary(client, userId);
  if (!accessSummary) {
    return new Response(
      sseEvent("error", {
        error: "Não foi possível verificar seu acesso no momento.",
      }),
      {
        status: 500,
        headers: SSE_HEADERS,
      }
    );
  }

  const accessDecision = await syncEffectiveAccessStatus(client, accessSummary);
  if (!accessDecision.allowed) {
    return new Response(
      sseEvent("error", {
        error: accessDecision.message,
        accessBlocked: true,
        accessStatus: accessDecision.effectiveStatus,
        reason: accessDecision.reason,
      }),
      {
        status: 403,
        headers: SSE_HEADERS,
      }
    );
  }

  const { data: conv } = await client
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conv) {
    return new Response(sseEvent("error", { error: "Conversa inválida ou sem permissão." }), {
      status: 403,
      headers: SSE_HEADERS,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let aborted = false;

      let keepAliveTimer: NodeJS.Timeout | null = null;
      let flushTimer: NodeJS.Timeout | null = null;

      const FLUSH_MIN_CHARS = 900;
      const FLUSH_MAX_DELAY_MS = 70;

      let pending = "";

      const cleanup = () => {
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
          keepAliveTimer = null;
        }

        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
      };

      const safeEnqueueRaw = (raw: string) => {
        if (closed || aborted) return false;

        try {
          controller.enqueue(encoder.encode(raw));
          return true;
        } catch {
          closed = true;
          cleanup();
          return false;
        }
      };

      const safeSend = (event: string, data: unknown) => {
        return safeEnqueueRaw(sseEvent(event, data));
      };

      const safeClose = () => {
        if (closed) return;

        closed = true;
        cleanup();

        try {
          controller.close();
        } catch {}
      };

      const flush = () => {
        if (!pending || closed || aborted) return;

        const out = pending;
        pending = "";

        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }

        safeSend("delta", { text: out });
      };

      const scheduleFlush = () => {
        if (flushTimer || closed || aborted) return;

        flushTimer = setTimeout(() => {
          flushTimer = null;
          flush();
        }, FLUSH_MAX_DELAY_MS);
      };

      const pushDelta = (text: string) => {
        if (!text || closed || aborted) return;

        pending += text;

        if (pending.length >= FLUSH_MIN_CHARS) {
          flush();
        } else {
          scheduleFlush();
        }
      };

      const onAbort = () => {
        aborted = true;
        cleanup();
        safeClose();
      };

      req.signal.addEventListener("abort", onAbort, { once: true });

      try {
        safeEnqueueRaw(":" + " ".repeat(2048) + "\n\n");

        keepAliveTimer = setInterval(() => {
          safeEnqueueRaw(":ka\n\n");
        }, 15000);

        const forceWebFirstRequested = shouldForceWebFirst(message);

        const { data: historyData } = await client
          .from("messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(MAX_HISTORY);

        if (aborted || closed) {
          safeClose();
          return;
        }

        const historyRows: MessageRow[] = (historyData as MessageRow[] | null) ?? [];
        historyRows.reverse();

        const { data: userMessageRow, error: insertUserError } = await client
          .from("messages")
          .insert({ conversation_id: conversationId, role: "user", content: message } as any)
          .select("*")
          .single();

        if (aborted || closed) {
          safeClose();
          return;
        }

        if (insertUserError || !userMessageRow) {
          safeSend("error", { error: "Não foi possível salvar a mensagem do usuário." });
          safeClose();
          return;
        }

        const pdfState = await getConversationPdfState(client, conversationId, userId);
        const pdfRow = await getPdfForConversation(client, conversationId, userId, pdfState);

        if (aborted || closed) {
          safeClose();
          return;
        }

        const pdfChatState = await resolvePdfChatState(client, pdfRow, userId, message);

        if (aborted || closed) {
          safeClose();
          return;
        }

        const forceWebFirst = forceWebFirstRequested && pdfChatState.kind === "none";

        safeSend("meta", {
          userMessage: userMessageRow,
          forceWebFirst,
          pdfFound: pdfChatState.kind !== "none",
          extractedTextStatus: pdfChatState.pdfRow?.extracted_text_status ?? null,
          vectorIndexStatus: pdfChatState.pdfRow?.vector_index_status ?? null,
          ocrUrl: OCR_URL,
        });

        if (
          pdfChatState.kind === "processing" ||
          pdfChatState.kind === "no_text" ||
          pdfChatState.kind === "error" ||
          pdfChatState.kind === "skipped_large"
        ) {
          safeSend("error", {
            error: pdfChatState.userError,
            ...(pdfChatState.ocrSuggested ? { ocrUrl: OCR_URL } : {}),
          });
          safeClose();
          return;
        }

        let combinedText = message.trim();

        if (historyRows.length > 0) {
          const historyText = historyRows
            .map(
              (m) => `${m.role === "user" ? "Usuário" : "Publ.IA"}: ${clampText(m.content, 1200)}`
            )
            .join("\n\n");

          combinedText =
            "Histórico recente (use só como contexto):\n\n" +
            clampText(historyText, 4500) +
            "\n\nNova pergunta:\n" +
            message.trim();
        }

        if (pdfChatState.kind === "ready_context" && pdfChatState.pdfContext) {
          combinedText =
            "CONTEXTO DO PDF (trechos selecionados):\n\n" +
            pdfChatState.pdfContext +
            "\n\n" +
            combinedText;
        }

        if (forceWebFirst) {
          combinedText =
            "WEB-FIRST recomendado: confirme em fonte oficial via web_search_preview.\n\n" +
            combinedText;
        }

        combinedText = clampText(combinedText, MAX_TOTAL_CHARS);

        const userContent: any[] = [{ type: "input_text", text: combinedText }];

        if (pdfChatState.kind === "ready_file" && pdfChatState.openaiFileId) {
          userContent.push({ type: "input_file", file_id: pdfChatState.openaiFileId });
        }

        const input: any[] = [{ role: "user", content: userContent }];

        const model =
          pdfChatState.kind === "ready_file" && pdfChatState.openaiFileId
            ? OPENAI_MODEL_WITH_PDF
            : OPENAI_MODEL_NO_PDF;

        let assistantText = "";
        let inputTokensUsed = 0;
        let outputTokensUsed = 0;

        try {
          const reqObj: any = {
            model,
            instructions: publiaPrompt,
            input,
            temperature: temp,
            stream: true,
          };

          if (forceWebFirst) {
            reqObj.tools = [{ type: "web_search_preview" }];
            reqObj.tool_choice = { type: "web_search_preview" };
          }

          const resp = await openai.responses.create(reqObj);

          for await (const event of resp as any) {
            if (aborted || closed) break;

            if (event?.type === "response.output_text.delta") {
              const delta = event.delta as string;

              if (delta) {
                assistantText += delta;
                pushDelta(delta);
              }
            }

            if (event?.type === "response.completed") {
              const usage = event?.response?.usage;

              inputTokensUsed = Number(usage?.input_tokens ?? usage?.prompt_tokens ?? 0) || 0;
              outputTokensUsed =
                Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0) || 0;
            }
          }

          flush();
          assistantText = formatAssistantText(assistantText);
        } catch (error) {
          console.error("Erro OpenAI em /api/chat:", error);
          safeSend("error", { error: "Erro ao gerar resposta da IA." });
          safeClose();
          return;
        }

        if (!assistantText.trim()) {
          safeSend("error", { error: "Não foi possível obter uma resposta da IA." });
          safeClose();
          return;
        }

        const { data: assistantMessageRow, error: insertAssistantError } = await client
          .from("messages")
          .insert({
            conversation_id: conversationId,
            role: "assistant",
            content: assistantText,
          } as any)
          .select("*")
          .single();

        if (insertAssistantError || !assistantMessageRow) {
          safeSend("error", { error: "Não foi possível salvar a resposta da IA." });
          safeClose();
          return;
        }

        const usageEventType: "chat_message" | "pdf_question" =
          pdfChatState.kind === "none" ? "chat_message" : "pdf_question";

        await registerUsageEvent(client, {
          userId,
          conversationId,
          eventType: usageEventType,
          inputTokens: inputTokensUsed,
          outputTokens: outputTokensUsed,
          metadata: {
            model,
            hasPdf: pdfChatState.kind !== "none",
            pdfKind: pdfChatState.kind,
            forceWebFirst,
          },
        });

        safeSend("done", { assistantMessage: assistantMessageRow });
        safeClose();
      } catch (error) {
        console.error("Erro inesperado em /api/chat:", error);
        safeSend("error", { error: "Erro inesperado ao processar a requisição." });
        safeClose();
      } finally {
        req.signal.removeEventListener("abort", onAbort);
      }
    },

    cancel() {
      // cleanup principal feito via abort/safeClose
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}