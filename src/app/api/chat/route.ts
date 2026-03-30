//src/app/api/chat/route.ts
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

const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const RAG_TOP_K = Math.max(2, Math.min(10, Number(process.env.RAG_TOP_K ?? 4)));

const OPENAI_MODEL_WITH_PDF =
  process.env.OPENAI_MODEL_WITH_PDF || "gpt-5.1";
const OPENAI_MODEL_NO_PDF =
  process.env.OPENAI_MODEL_NO_PDF || "gpt-5.1";

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

type PdfChatMode = "active" | "all" | "selected";

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

type ConversationPdfLinkRow = {
  pdf_file_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type OrderedPdfLink = {
  pdfFileId: string;
  isActive: boolean;
};

type MatchPdfChunkRow = {
  chunk_index: number;
  content: string;
};

type UserProfileContext = {
  municipio: string | null;
  uf: string | null;
  porte_municipio: string | null;
};

type PdfResolution =
  | {
      status: "ready_context";
      pdfRow: PdfFileRow;
      pdfContext: string;
      openaiFileId: null;
      userError: null;
      ocrSuggested: false;
    }
  | {
      status: "ready_file";
      pdfRow: PdfFileRow;
      pdfContext: "";
      openaiFileId: string;
      userError: null;
      ocrSuggested: false;
    }
  | {
      status: "processing";
      pdfRow: PdfFileRow;
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: false;
    }
  | {
      status: "no_text";
      pdfRow: PdfFileRow;
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: true;
    }
  | {
      status: "error";
      pdfRow: PdfFileRow;
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: false;
    }
  | {
      status: "skipped_large";
      pdfRow: PdfFileRow;
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: false;
    };

type PdfChatState =
  | {
      kind: "none";
      pdfRows: [];
      pdfContext: "";
      openaiFileId: null;
      userError: null;
      ocrSuggested: false;
      pdfCount: 0;
      activePdfFileId: null;
    }
  | {
      kind: "ready_context";
      pdfRows: PdfFileRow[];
      pdfContext: string;
      openaiFileId: null;
      userError: null;
      ocrSuggested: false;
      pdfCount: number;
      activePdfFileId: string | null;
    }
  | {
      kind: "ready_file";
      pdfRows: [PdfFileRow];
      pdfContext: "";
      openaiFileId: string;
      userError: null;
      ocrSuggested: false;
      pdfCount: 1;
      activePdfFileId: string | null;
    }
  | {
      kind: "processing";
      pdfRows: PdfFileRow[];
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: false;
      pdfCount: number;
      activePdfFileId: string | null;
    }
  | {
      kind: "no_text";
      pdfRows: PdfFileRow[];
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: true;
      pdfCount: number;
      activePdfFileId: string | null;
    }
  | {
      kind: "error";
      pdfRows: PdfFileRow[];
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: false;
      pdfCount: number;
      activePdfFileId: string | null;
    }
  | {
      kind: "skipped_large";
      pdfRows: PdfFileRow[];
      pdfContext: "";
      openaiFileId: null;
      userError: string;
      ocrSuggested: false;
      pdfCount: number;
      activePdfFileId: string | null;
    };

// --------------------
// LIMITES
// --------------------
const MAX_HISTORY = 4;
const MAX_PDF_CONTEXT_CHARS = 6000;
const MAX_TOTAL_CHARS = 10000;
const MAX_EXTRACTED_TEXT_CHARS = 150000;
const MAX_FULL_FILE_FALLBACK_MB = 20;
const MAX_MULTI_PDFS_IN_CONTEXT = 3;

const OCR_URL = "https://smallpdf.com/pt/pdf-ocr";
const PDF_PROCESSING_MESSAGE =
  "Os PDFs anexados ainda estão sendo processados. Aguarde alguns instantes e tente novamente.";
const PDF_TECHNICAL_MESSAGE =
  "Os PDFs foram anexados, mas houve uma falha técnica no processamento. Tente reprocessar ou reenviar o arquivo.";
const PDF_NO_TEXT_MESSAGE =
  "Infelizmente não consigo acessar o conteúdo dos PDFs. Faça OCR e reenvie. Use o botão FAZER OCR abaixo para abrir aplicativo.";
const PDF_LARGE_MESSAGE =
  "Um ou mais PDFs são grandes demais para processamento automático neste momento. Envie uma versão menor ou reprocessada.";

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

function stripTrailingUrlPunctuation(url: string) {
  const cleaned = String(url ?? "").trim().replace(/[),.;:!?]+$/g, "");
  const trailing = String(url ?? "").slice(cleaned.length);
  return { cleaned, trailing };
}

function convertNamedLinksToMarkdown(text: string) {
  let out = String(text || "");

  // Caso:
  // Título do site
  // Endereço completo: https://...
  out = out.replace(
    /(^|\n)([^\n]{3,160})\n{1,2}(?:\*\*|__)?(?:Endere[cç]o completo|URL|Link|Acesse em)(?:\*\*|__)?\s*:\s*(https?:\/\/[^\s<]+)/gim,
    (match, prefix: string, label: string, rawUrl: string) => {
      const { cleaned, trailing } = stripTrailingUrlPunctuation(rawUrl);
      const safeLabel = label.trim();
      if (!safeLabel || !cleaned) return match;
      return `${prefix}[${safeLabel}](${cleaned})${trailing}`;
    }
  );

  // Caso:
  // Nome do portal: https://...
  out = out.replace(
    /(^|\n)([-*]\s*)?([^\n:]{3,180})\s*:\s*(https?:\/\/[^\s<]+)/gim,
    (match, prefix: string, bullet: string = "", label: string, rawUrl: string) => {
      const safeLabel = label.trim();
      const lower = safeLabel.toLowerCase();

      if (
        lower === "base legal" ||
        lower === "referências oficiais consultadas" ||
        lower === "referencias oficiais consultadas"
      ) {
        return match;
      }

      const { cleaned, trailing } = stripTrailingUrlPunctuation(rawUrl);
      if (!safeLabel || !cleaned) return match;

      return `${prefix}${bullet}[${safeLabel}](${cleaned})${trailing}`;
    }
  );

  // Caso:
  // Nome do portal
  // https://...
  out = out.replace(
    /(^|\n)([^\n]{3,180})\n{1,2}(https?:\/\/[^\s<]+)/gim,
    (match, prefix: string, label: string, rawUrl: string) => {
      const safeLabel = label.trim();
      const lower = safeLabel.toLowerCase();

      if (
        lower === "base legal" ||
        lower === "referências oficiais consultadas" ||
        lower === "referencias oficiais consultadas" ||
        lower.startsWith("- ") ||
        lower.startsWith("• ")
      ) {
        return match;
      }

      const { cleaned, trailing } = stripTrailingUrlPunctuation(rawUrl);
      if (!safeLabel || !cleaned) return match;

      return `${prefix}[${safeLabel}](${cleaned})${trailing}`;
    }
  );

  return out;
}

function formatAssistantText(text: string) {
  const trimmed = String(text || "").trim();
  return convertNamedLinksToMarkdown(trimmed);
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

function shouldForceOfficialLinks(text: string) {
  const t = String(text || "").toLowerCase();

  const keywords = [
    "site",
    "sites",
    "portal",
    "portais",
    "link",
    "links",
    "url",
    "urls",
    "acesse",
    "acessar",
    "consultar",
    "onde consultar",
    "onde posso consultar",
    "endereço",
    "endereco",
    "página oficial",
    "pagina oficial",
  ];

  return keywords.some((k) => t.includes(k));
}

function buildOfficialLinksInstruction() {
  return [
    "INSTRUÇÃO OBRIGATÓRIA SOBRE LINKS:",
    "- Quando citar site, portal, sistema, manual, tribunal ou página oficial, escreva SEMPRE a URL oficial completa.",
    "- Sempre prefira o formato Markdown clicável: [Nome do portal](https://url-oficial).",
    "- Nunca escreva apenas o nome do portal sem URL.",
    "- Se citar mais de um site, cada um deve aparecer com seu respectivo link clicável.",
    "- Se necessário, use web_search_preview para localizar a URL oficial exata antes de responder.",
  ].join("\n");
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

function buildPdfLabel(pdfRow: PdfFileRow, index?: number) {
  const name = String(pdfRow.file_name ?? "").trim();
  if (name) return name;
  return `PDF ${typeof index === "number" ? index + 1 : pdfRow.id.slice(0, 8)}`;
}

function formatPorteMunicipioLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "pequeno") return "Pequeno";
  if (normalized === "medio") return "Médio";
  if (normalized === "grande") return "Grande";

  return "";
}

function buildUserProfileContextText(profile: UserProfileContext | null) {
  if (!profile) return "";

  const municipio = String(profile.municipio ?? "").trim();
  const uf = String(profile.uf ?? "").trim().toUpperCase();
  const porte = formatPorteMunicipioLabel(profile.porte_municipio);

  const lines: string[] = [];

  if (municipio || uf) {
    lines.push(
      `Município/UF do usuário cadastrado: ${[municipio, uf].filter(Boolean).join(" / ")}`
    );
  }

  if (porte) {
    lines.push(`Porte do município cadastrado: ${porte}`);
  }

  if (!lines.length) return "";

  return (
    "CONTEXTO CADASTRAL DO USUÁRIO (usar como referência padrão da conversa, sem perguntar novamente esses dados por rotina):\n\n" +
    lines.join("\n") +
    "\n\nINSTRUÇÃO IMPORTANTE: use esse contexto cadastral como base inicial da resposta. Só peça confirmação de município/UF ou Tribunal de Contas competente se o usuário indicar outra localidade, outro ente, consórcio, órgão estadual/federal, ou se houver dúvida real de jurisdição."
  );
}

async function getUserProfileContext(
  client: any,
  userId: string
): Promise<UserProfileContext | null> {
  const { data, error } = await client
    .from("profiles")
    .select("municipio, uf, porte_municipio")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[/api/chat] erro ao buscar contexto do profile:", error);
    return null;
  }

  if (!data) return null;

  return {
    municipio: (data as any).municipio ?? null,
    uf: (data as any).uf ?? null,
    porte_municipio: (data as any).porte_municipio ?? null,
  };
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
    active_pdf_file_id:
      ((data as any).active_pdf_file_id as string | null) ?? null,
  };
}

async function getPdfsForConversation(
  client: any,
  conversationId: string,
  userId: string,
  state: ConversationPdfState
): Promise<PdfFileRow[]> {
  if (!state.pdf_enabled) return [];

  const { data: links, error: linksError } = await client
    .from("conversation_pdf_links")
    .select("pdf_file_id, is_active, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (linksError) {
    console.error("[/api/chat] erro ao buscar vínculos dos PDFs:", linksError);
    return [];
  }

  const orderedIdsRaw: OrderedPdfLink[] = ((links ?? []) as ConversationPdfLinkRow[])
    .map((item: ConversationPdfLinkRow) => ({
      pdfFileId: String(item?.pdf_file_id ?? "").trim(),
      isActive: item?.is_active === true,
    }))
    .filter((item: OrderedPdfLink) => !!item.pdfFileId);

  let orderedIds: string[] = orderedIdsRaw.map(
    (item: OrderedPdfLink) => item.pdfFileId
  );

  const activeId = String(state.active_pdf_file_id ?? "").trim();
  if (activeId && orderedIds.includes(activeId)) {
    orderedIds = [
      activeId,
      ...orderedIds.filter((pdfFileId: string) => pdfFileId !== activeId),
    ];
  } else {
    const activeFromLinks = orderedIdsRaw.find(
      (item: OrderedPdfLink) => item.isActive
    )?.pdfFileId;

    if (activeFromLinks && orderedIds.includes(activeFromLinks)) {
      orderedIds = [
        activeFromLinks,
        ...orderedIds.filter(
          (pdfFileId: string) => pdfFileId !== activeFromLinks
        ),
      ];
    }
  }

  if (!orderedIds.length) {
    const { data: latest } = await client
      .from("pdf_files")
      .select(
        "id, conversation_id, user_id, file_name, storage_path, openai_file_id, file_size, created_at, extracted_text, extracted_text_status, extracted_text_error, vector_index_status, vector_index_error, vector_chunks_count"
      )
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const rows = (latest ?? []) as PdfFileRow[];
    return rows.filter(
      (row: PdfFileRow) =>
        row.storage_path && !String(row.storage_path).includes("..")
    );
  }

  const { data: pdfRows, error: pdfError } = await client
    .from("pdf_files")
    .select(
      "id, conversation_id, user_id, file_name, storage_path, openai_file_id, file_size, created_at, extracted_text, extracted_text_status, extracted_text_error, vector_index_status, vector_index_error, vector_chunks_count"
    )
    .in("id", orderedIds)
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (pdfError || !pdfRows) {
    console.error("[/api/chat] erro ao buscar PDFs da conversa:", pdfError);
    return [];
  }

  const byId = new Map<string, PdfFileRow>();
  for (const row of pdfRows as PdfFileRow[]) {
    if (!row.storage_path || String(row.storage_path).includes("..")) continue;
    byId.set(row.id, row);
  }

  return orderedIds
    .map((id: string) => byId.get(id) ?? null)
    .filter(Boolean) as PdfFileRow[];
}

function applyPdfChatMode(params: {
  pdfRows: PdfFileRow[];
  pdfMode: PdfChatMode;
  selectedPdfIds: string[];
  activePdfFileId: string | null;
}) {
  const { pdfRows, pdfMode, selectedPdfIds, activePdfFileId } = params;

  if (!pdfRows.length) return [];

  if (pdfMode === "active") {
    const activeId = String(activePdfFileId ?? "").trim();
    if (!activeId) return pdfRows.slice(0, 1);
    return pdfRows.filter((row) => row.id === activeId).slice(0, 1);
  }

  if (pdfMode === "selected") {
    const selectedSet = new Set(
      selectedPdfIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    );

    if (!selectedSet.size) return [];

    const filtered = pdfRows.filter((row) => selectedSet.has(row.id));

    const ordered = [
      ...selectedPdfIds
        .map((id) => filtered.find((row) => row.id === id) ?? null)
        .filter(Boolean),
    ] as PdfFileRow[];

    return ordered;
  }

  return pdfRows;
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

async function uploadPdfToOpenAI(
  client: any,
  pdfRow: PdfFileRow
): Promise<string | null> {
  if (!openai) return null;

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

async function buildPdfContextFromExtractedText(
  pdfRow: PdfFileRow,
  message: string,
  maxChars: number
) {
  if (String(pdfRow.extracted_text_status ?? "").toLowerCase() !== "ready") {
    return "";
  }
  if (!pdfRow.extracted_text) return "";

  const text = clampText(
    normalizeText(pdfRow.extracted_text),
    MAX_EXTRACTED_TEXT_CHARS
  );

  const chunks = chunkText(text, {
    chunkSize: 1200,
    overlap: 200,
    maxChunks: 320,
  });

  const picked = pickRelevantChunks(chunks, message, {
    maxChunks: 4,
    maxChars,
    minScore: 1,
  });

  if (!picked.length) return "";

  const label = buildPdfLabel(pdfRow);

  const raw = picked
    .map(
      (c, i) =>
        `[${label}] Trecho ${i + 1} (chunk #${c.index}):\n${c.text}`
    )
    .join("\n\n---\n\n");

  return clampText(raw, maxChars);
}

async function buildPdfContextFromVector(
  client: any,
  pdfRow: PdfFileRow,
  message: string,
  maxChars: number
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

  const label = buildPdfLabel(pdfRow);

  const raw = (matches as MatchPdfChunkRow[])
    .map(
      (m: MatchPdfChunkRow, i: number) =>
        `[${label}] Trecho ${i + 1} (chunk #${m.chunk_index}):\n${m.content}`
    )
    .join("\n\n---\n\n");

  return clampText(raw, maxChars);
}

async function resolveSinglePdf(
  client: any,
  pdfRow: PdfFileRow,
  userId: string,
  message: string,
  maxCharsForThisPdf: number
): Promise<PdfResolution> {
  const extractedStatus = String(pdfRow.extracted_text_status ?? "").toLowerCase();
  const vectorStatus = String(pdfRow.vector_index_status ?? "").toLowerCase();

  const vectorContext = await buildPdfContextFromVector(
    client,
    pdfRow,
    message,
    maxCharsForThisPdf
  );
  if (vectorContext) {
    return {
      status: "ready_context",
      pdfRow,
      pdfContext: vectorContext,
      openaiFileId: null,
      userError: null,
      ocrSuggested: false,
    };
  }

  const extractedContext = await buildPdfContextFromExtractedText(
    pdfRow,
    message,
    maxCharsForThisPdf
  );
  if (extractedContext) {
    return {
      status: "ready_context",
      pdfRow,
      pdfContext: extractedContext,
      openaiFileId: null,
      userError: null,
      ocrSuggested: false,
    };
  }

  if (extractedStatus === "pending" || extractedStatus === "processing") {
    return {
      status: "processing",
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
        status: "no_text",
        pdfRow,
        pdfContext: "",
        openaiFileId: null,
        userError: PDF_NO_TEXT_MESSAGE,
        ocrSuggested: true,
      };
    }

    return {
      status: "error",
      pdfRow,
      pdfContext: "",
      openaiFileId: null,
      userError: PDF_TECHNICAL_MESSAGE,
      ocrSuggested: false,
    };
  }

  if (extractedStatus === "skipped_large") {
    return {
      status: "skipped_large",
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
          status: "ready_file",
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
    status: "error",
    pdfRow,
    pdfContext: "",
    openaiFileId: null,
    userError: PDF_TECHNICAL_MESSAGE,
    ocrSuggested: false,
  };
}

async function resolvePdfChatState(
  client: any,
  pdfRows: PdfFileRow[],
  userId: string,
  message: string,
  activePdfFileId: string | null
): Promise<PdfChatState> {
  if (!pdfRows.length) {
    return {
      kind: "none",
      pdfRows: [],
      pdfContext: "",
      openaiFileId: null,
      userError: null,
      ocrSuggested: false,
      pdfCount: 0,
      activePdfFileId: null,
    };
  }

  const rowsToUse = pdfRows.slice(0, MAX_MULTI_PDFS_IN_CONTEXT);
  const maxCharsPerPdf = Math.max(
    1400,
    Math.floor(MAX_PDF_CONTEXT_CHARS / Math.max(1, rowsToUse.length))
  );

  const resolutions = await Promise.all(
    rowsToUse.map((pdfRow: PdfFileRow) =>
      resolveSinglePdf(client, pdfRow, userId, message, maxCharsPerPdf)
    )
  );

  const readyContexts = resolutions.filter(
    (item: PdfResolution) => item.status === "ready_context"
  ) as Array<Extract<PdfResolution, { status: "ready_context" }>>;

  if (readyContexts.length > 0) {
    const combinedContext = clampText(
      readyContexts
        .map((item) => item.pdfContext)
        .filter(Boolean)
        .join("\n\n====================\n\n"),
      MAX_PDF_CONTEXT_CHARS
    );

    return {
      kind: "ready_context",
      pdfRows: rowsToUse,
      pdfContext: combinedContext,
      openaiFileId: null,
      userError: null,
      ocrSuggested: false,
      pdfCount: rowsToUse.length,
      activePdfFileId,
    };
  }

  if (rowsToUse.length === 1) {
    const single = resolutions[0];

    if (single.status === "ready_file" && single.openaiFileId) {
      return {
        kind: "ready_file",
        pdfRows: [single.pdfRow],
        pdfContext: "",
        openaiFileId: single.openaiFileId,
        userError: null,
        ocrSuggested: false,
        pdfCount: 1,
        activePdfFileId,
      };
    }

    if (single.status === "processing") {
      return {
        kind: "processing",
        pdfRows: rowsToUse,
        pdfContext: "",
        openaiFileId: null,
        userError: single.userError,
        ocrSuggested: false,
        pdfCount: 1,
        activePdfFileId,
      };
    }

    if (single.status === "no_text") {
      return {
        kind: "no_text",
        pdfRows: rowsToUse,
        pdfContext: "",
        openaiFileId: null,
        userError: single.userError,
        ocrSuggested: true,
        pdfCount: 1,
        activePdfFileId,
      };
    }

    if (single.status === "skipped_large") {
      return {
        kind: "skipped_large",
        pdfRows: rowsToUse,
        pdfContext: "",
        openaiFileId: null,
        userError: single.userError,
        ocrSuggested: false,
        pdfCount: 1,
        activePdfFileId,
      };
    }

    return {
      kind: "error",
      pdfRows: rowsToUse,
      pdfContext: "",
      openaiFileId: null,
      userError: PDF_TECHNICAL_MESSAGE,
      ocrSuggested: false,
      pdfCount: 1,
      activePdfFileId,
    };
  }

  if (resolutions.some((item: PdfResolution) => item.status === "processing")) {
    return {
      kind: "processing",
      pdfRows: rowsToUse,
      pdfContext: "",
      openaiFileId: null,
      userError:
        "Nenhum dos PDFs anexados está pronto para consulta ainda. Aguarde o processamento e tente novamente.",
      ocrSuggested: false,
      pdfCount: rowsToUse.length,
      activePdfFileId,
    };
  }

  if (resolutions.every((item: PdfResolution) => item.status === "no_text")) {
    return {
      kind: "no_text",
      pdfRows: rowsToUse,
      pdfContext: "",
      openaiFileId: null,
      userError: PDF_NO_TEXT_MESSAGE,
      ocrSuggested: true,
      pdfCount: rowsToUse.length,
      activePdfFileId,
    };
  }

  if (resolutions.some((item: PdfResolution) => item.status === "skipped_large")) {
    return {
      kind: "skipped_large",
      pdfRows: rowsToUse,
      pdfContext: "",
      openaiFileId: null,
      userError: PDF_LARGE_MESSAGE,
      ocrSuggested: false,
      pdfCount: rowsToUse.length,
      activePdfFileId,
    };
  }

  return {
    kind: "error",
    pdfRows: rowsToUse,
    pdfContext: "",
    openaiFileId: null,
    userError: PDF_TECHNICAL_MESSAGE,
    ocrSuggested: false,
    pdfCount: rowsToUse.length,
    activePdfFileId,
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
    return new Response(
      sseEvent("error", { error: "Servidor incompleto. Verifique envs." }),
      {
        status: 500,
        headers: SSE_HEADERS,
      }
    );
  }

  const client = createAuthClient(req) as any;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      sseEvent("error", { error: "Corpo inválido. JSON era esperado." }),
      {
        status: 400,
        headers: SSE_HEADERS,
      }
    );
  }

  const {
    conversationId,
    message,
    temperature,
    pdfMode,
    selectedPdfIds,
  } = body as {
    conversationId: string;
    message: string;
    temperature?: number;
    pdfMode?: PdfChatMode;
    selectedPdfIds?: string[];
  };

  const temp = parseTemperature(temperature, 0.3);

  if (!conversationId) {
    return new Response(
      sseEvent("error", { error: "conversationId é obrigatório." }),
      {
        status: 400,
        headers: SSE_HEADERS,
      }
    );
  }

  if (!message?.trim()) {
    return new Response(sseEvent("error", { error: "Mensagem vazia." }), {
      status: 400,
      headers: SSE_HEADERS,
    });
  }

  const normalizedPdfMode: PdfChatMode =
    pdfMode === "active" || pdfMode === "selected" ? pdfMode : "all";

  const normalizedSelectedPdfIds = Array.isArray(selectedPdfIds)
    ? selectedPdfIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];

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
    return new Response(
      sseEvent("error", { error: "Conversa inválida ou sem permissão." }),
      {
        status: 403,
        headers: SSE_HEADERS,
      }
    );
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
        const forceOfficialLinksRequested = shouldForceOfficialLinks(message);

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
          .insert({
            conversation_id: conversationId,
            role: "user",
            content: message,
          } as any)
          .select("*")
          .single();

        if (aborted || closed) {
          safeClose();
          return;
        }

        if (insertUserError || !userMessageRow) {
          safeSend("error", {
            error: "Não foi possível salvar a mensagem do usuário.",
          });
          safeClose();
          return;
        }

        const userProfile = await getUserProfileContext(client, userId);

        const pdfState = await getConversationPdfState(client, conversationId, userId);
        const allPdfRows = await getPdfsForConversation(
          client,
          conversationId,
          userId,
          pdfState
        );

        if (aborted || closed) {
          safeClose();
          return;
        }

        const pdfRows = applyPdfChatMode({
          pdfRows: allPdfRows,
          pdfMode: normalizedPdfMode,
          selectedPdfIds: normalizedSelectedPdfIds,
          activePdfFileId: pdfState.active_pdf_file_id,
        });

        const pdfChatState = await resolvePdfChatState(
          client,
          pdfRows,
          userId,
          message,
          pdfState.active_pdf_file_id
        );

        if (aborted || closed) {
          safeClose();
          return;
        }

        if (normalizedPdfMode === "selected" && allPdfRows.length > 0 && pdfRows.length === 0) {
          safeSend("error", {
            error: "Nenhum PDF foi selecionado para esta pergunta.",
          });
          safeClose();
          return;
        }

        const forceWebFirst = forceWebFirstRequested && pdfChatState.kind === "none";
        const shouldOfferWebTool =
          (forceWebFirst || forceOfficialLinksRequested) && pdfChatState.kind === "none";

        safeSend("meta", {
          userMessage: userMessageRow,
          forceWebFirst,
          pdfFound: pdfChatState.kind !== "none",
          pdfCount: pdfChatState.pdfCount,
          activePdfFileId: pdfChatState.activePdfFileId,
          pdfMode: normalizedPdfMode,
          pdfNames: pdfChatState.pdfRows.map((pdf: PdfFileRow) => buildPdfLabel(pdf)),
          extractedTextStatus:
            pdfChatState.pdfRows.length === 1
              ? pdfChatState.pdfRows[0]?.extracted_text_status ?? null
              : null,
          vectorIndexStatus:
            pdfChatState.pdfRows.length === 1
              ? pdfChatState.pdfRows[0]?.vector_index_status ?? null
              : null,
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
              (m: MessageRow) =>
                `${m.role === "user" ? "Usuário" : "Publ.IA"}: ${clampText(
                  m.content,
                  1200
                )}`
            )
            .join("\n\n");

          combinedText =
            "Histórico recente (use só como contexto):\n\n" +
            clampText(historyText, 4500) +
            "\n\nNova pergunta:\n" +
            message.trim();
        }

        const userProfileContextText = buildUserProfileContextText(userProfile);
        if (userProfileContextText) {
          combinedText =
            userProfileContextText +
            "\n\n" +
            combinedText;
        }

        if (pdfChatState.kind === "ready_context" && pdfChatState.pdfContext) {
          combinedText =
            "CONTEXTO DOS PDFs ANEXADOS (trechos selecionados e identificados por arquivo):\n\n" +
            pdfChatState.pdfContext +
            "\n\nINSTRUÇÃO IMPORTANTE: ao comparar documentos, cite claramente o nome de cada PDF ao mencionar diferenças, convergências, riscos ou contradições.\n\n" +
            combinedText;
        }

        if (forceOfficialLinksRequested) {
          combinedText =
            buildOfficialLinksInstruction() +
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
          userContent.push({
            type: "input_file",
            file_id: pdfChatState.openaiFileId,
          });
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

          if (shouldOfferWebTool) {
            reqObj.tools = [{ type: "web_search_preview" }];
          }

          if (forceWebFirst) {
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

              inputTokensUsed =
                Number(usage?.input_tokens ?? usage?.prompt_tokens ?? 0) || 0;
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
          safeSend("error", {
            error: "Não foi possível obter uma resposta da IA.",
          });
          safeClose();
          return;
        }

        const { data: assistantMessageRow, error: insertAssistantError } =
          await client
            .from("messages")
            .insert({
              conversation_id: conversationId,
              role: "assistant",
              content: assistantText,
            } as any)
            .select("*")
            .single();

        if (insertAssistantError || !assistantMessageRow) {
          safeSend("error", {
            error: "Não foi possível salvar a resposta da IA.",
          });
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
            pdfMode: normalizedPdfMode,
            pdfCount: pdfChatState.pdfCount,
            activePdfFileId: pdfChatState.activePdfFileId,
            selectedPdfIds: normalizedSelectedPdfIds,
            pdfNames: pdfChatState.pdfRows.map((pdf: PdfFileRow) => buildPdfLabel(pdf)),
            forceWebFirst,
            forceOfficialLinksRequested,
            userProfileContextApplied: !!userProfileContextText,
          },
        });

        safeSend("done", { assistantMessage: assistantMessageRow });
        safeClose();
      } catch (error) {
        console.error("Erro inesperado em /api/chat:", error);
        safeSend("error", {
          error: "Erro inesperado ao processar a requisição.",
        });
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