import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

import { publiaPrompt } from "@/lib/publiaPrompt";
import { chunkText, pickRelevantChunks } from "@/lib/pdf/chunking";

export const runtime = "nodejs";

// ---- Supabase & OpenAI ----
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

let supabase: ReturnType<typeof createClient> | null = null;
let openai: OpenAI | null = null;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[/api/chat] Variáveis de ambiente do Supabase não estão definidas.", {
    hasUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
  });
} else {
  supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

if (!openaiApiKey) {
  console.error("[/api/chat] OPENAI_API_KEY não está definida.");
} else {
  openai = new OpenAI({ apiKey: openaiApiKey });
}

// ---- Auth helpers (cookie -> user) ----
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
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase anon envs faltando");

  const jar = parseCookieHeader(req.headers.get("cookie"));

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return jar[name];
      },
      set() {},
      remove() {},
    },
  });
}

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type PdfFileRow = {
  id: string;
  conversation_id: string;
  file_name: string | null;
  storage_path: string;
  openai_file_id: string | null;
  created_at: string;
};

function formatAssistantText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function getLatestPdfForConversation(
  conversationId: string,
  userId: string
): Promise<PdfFileRow | null> {
  if (!supabase) return null;

  const client = supabase as any;

  const { data, error } = await client
    .from("pdf_files")
    .select("id, conversation_id, file_name, storage_path, openai_file_id, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  if (!data[0].storage_path || data[0].storage_path.includes("..")) return null;

  return data[0] as PdfFileRow;
}

async function downloadPdfBuffer(pdfRow: PdfFileRow): Promise<Buffer | null> {
  if (!supabase) return null;
  const client = supabase as any;

  const { data: fileData, error } = await client.storage
    .from("pdf-files")
    .download(pdfRow.storage_path);

  if (error || !fileData) return null;

  try {
    return Buffer.from(await fileData.arrayBuffer());
  } catch {
    return null;
  }
}

async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    // ✅ dynamic import pra evitar erro de bundling/default export no Next
    const mod: any = await import("pdf-parse");
    const fn: any = mod?.default ?? mod;
    const parsed = await fn(buffer);
    const text = (parsed?.text || "").trim();
    return text || null;
  } catch (e) {
    console.warn("[/api/chat] Falha ao extrair texto do PDF (pdf-parse).", e);
    return null;
  }
}

async function uploadPdfToOpenAI(pdfRow: PdfFileRow): Promise<string | null> {
  if (!supabase || !openai) return null;

  const client = supabase as any;

  const { data: fileData, error: downloadError } = await client.storage
    .from("pdf-files")
    .download(pdfRow.storage_path);

  if (downloadError || !fileData) return null;

  try {
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const filename = pdfRow.file_name || "documento.pdf";

    const fileForOpenAI = await toFile(buffer, filename, {
      type: "application/pdf",
    });

    const uploaded = await openai.files.create({
      file: fileForOpenAI,
      purpose: "user_data",
    });

    return uploaded.id;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!supabase || !openai) {
    return new Response(
      sseEvent("error", {
        error: "Configuração do servidor incompleta. Verifique envs do Supabase e OpenAI.",
      }),
      { status: 500, headers: SSE_HEADERS }
    );
  }

  const client = supabase as any;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      sseEvent("error", { error: "Corpo da requisição inválido. JSON era esperado." }),
      { status: 400, headers: SSE_HEADERS }
    );
  }

  const { conversationId, message } = body as { conversationId: string; message: string };

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

  // ✅ auth
  let userId: string | null = null;
  try {
    const auth = createAuthClient(req);
    const { data, error } = await auth.auth.getUser();
    if (error || !data?.user) {
      return new Response(sseEvent("error", { error: "Não autenticado." }), {
        status: 401,
        headers: SSE_HEADERS,
      });
    }
    userId = data.user.id;
  } catch {
    return new Response(sseEvent("error", { error: "Não autenticado." }), {
      status: 401,
      headers: SSE_HEADERS,
    });
  }

  // ✅ ownership
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
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        // 0) histórico
        const MAX_HISTORY = 8;
        const { data: historyData } = await client
          .from("messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(MAX_HISTORY);

        const historyRows: MessageRow[] = (historyData as MessageRow[] | null) ?? [];
        historyRows.reverse();

        // 1) salva msg usuário
        const { data: userMessageRow, error: insertUserError } = await client
          .from("messages")
          .insert({
            conversation_id: conversationId,
            role: "user",
            content: message,
          } as any)
          .select("*")
          .single();

        if (insertUserError || !userMessageRow) {
          send("error", { error: "Não foi possível salvar a mensagem do usuário." });
          controller.close();
          return;
        }

        send("meta", { userMessage: userMessageRow });

        // 2) PDF: extrai texto -> chunk -> seleciona trechos relevantes
        let openaiFileId: string | null = null; // fallback: input_file
        let pdfContext = ""; // preferencial: texto selecionado

        const latestPdf = await getLatestPdfForConversation(conversationId, userId!);

        if (latestPdf) {
          const buf = await downloadPdfBuffer(latestPdf);
          if (buf) {
            const textRaw = await extractPdfText(buf);

            if (textRaw) {
              const HARD_LIMIT = 250_000; // chars
              const text = textRaw.length > HARD_LIMIT ? textRaw.slice(0, HARD_LIMIT) : textRaw;

              const chunks = chunkText(text, { chunkSize: 1400, overlap: 200, maxChunks: 400 });
              const picked = pickRelevantChunks(chunks, message, {
                maxChunks: 6,
                maxChars: 9000,
                minScore: 1,
              });

              pdfContext = picked
                .map((c, i) => `Trecho ${i + 1} (chunk #${c.index}):\n${c.text}`)
                .join("\n\n---\n\n");
            }
          }

          // fallback: se não extrair texto, usa input_file (OpenAI) como antes
          if (!pdfContext) {
            if (latestPdf.openai_file_id) {
              openaiFileId = latestPdf.openai_file_id;
            } else {
              const uploadedId = await uploadPdfToOpenAI(latestPdf);
              if (uploadedId) {
                openaiFileId = uploadedId;

                await client
                  .from("pdf_files")
                  .update({ openai_file_id: uploadedId } as any)
                  .eq("id", latestPdf.id)
                  .eq("user_id", userId!);
              }
            }
          }
        }

        // 3) monta contexto (histórico + pergunta + PDF selecionado)
        let combinedText = message.trim();

        if (historyRows.length > 0) {
          const historyText = historyRows
            .map((m) => {
              const prefix = m.role === "user" ? "Usuário" : "Publ.IA";
              return `${prefix}: ${m.content}`;
            })
            .join("\n\n");

          combinedText =
            "Histórico recente da conversa (não repita literalmente, use apenas como contexto):\n\n" +
            historyText +
            "\n\nNova pergunta do usuário:\n" +
            message.trim();
        }

        if (pdfContext) {
          combinedText =
            "CONTEXTO DO PDF (trechos selecionados; se não estiver aqui, diga que não encontrou no PDF):\n\n" +
            pdfContext +
            "\n\n" +
            combinedText;
        }

        const MAX_TOTAL_CHARS = 18000;
        if (combinedText.length > MAX_TOTAL_CHARS) combinedText = combinedText.slice(-MAX_TOTAL_CHARS);

        const userContent: any[] = [{ type: "input_text", text: combinedText }];

        if (openaiFileId) {
          userContent.push({ type: "input_file", file_id: openaiFileId });
        }

        const input: any[] = [{ role: "user", content: userContent }];

        // modelos
        const modelWithPdf = process.env.OPENAI_MODEL_WITH_PDF || "gpt-5.1-mini";
        const modelNoPdf = process.env.OPENAI_MODEL_NO_PDF || "gpt-5.1";
        const model = openaiFileId ? modelWithPdf : modelNoPdf;

        const responseStream = await openai.responses.create({
          model,
          instructions: publiaPrompt,
          tools: [{ type: "web_search_preview" }],
          input,
          stream: true,
        } as any);

        let assistantText = "";

        for await (const event of responseStream as any) {
          if (event?.type === "response.output_text.delta") {
            const delta = event.delta as string;
            if (delta) {
              assistantText += delta;
              send("delta", { text: delta });
            }
          }
        }

        if (!assistantText.trim()) {
          send("error", { error: "Não foi possível obter uma resposta da IA." });
          controller.close();
          return;
        }

        assistantText = formatAssistantText(assistantText);

        // 4) salva msg IA
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
          send("error", { error: "Não foi possível salvar a resposta da IA." });
          controller.close();
          return;
        }

        send("done", { assistantMessage: assistantMessageRow });
        controller.close();
      } catch (err) {
        console.error("Erro inesperado em /api/chat:", err);
        controller.enqueue(
          encoder.encode(sseEvent("error", { error: "Erro inesperado ao processar a requisição." }))
        );
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
