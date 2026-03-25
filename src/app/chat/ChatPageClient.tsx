// src/app/chat/chatPageClient.tsx
"use client";

import { copyMessageToClipboard } from "@/lib/copy/copyMessageToClipboard";
import {
  useEffect,
  useState,
  useRef,
  ChangeEvent,
  useCallback,
  useMemo,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";
import {
  canUseAiFeatures,
  fetchAccessSummary,
  getBlockedAccessMessage,
  type FrontendAccessSummary,
} from "@/lib/access-client";
import { getBlockedAccessCta } from "@/lib/access-cta";

import { ChatSidebar } from "./components/ChatSidebar";
import { ChatEmptyState } from "./components/ChatEmptyState";
import { ChatInput } from "./components/ChatInput";
import { ChatMessage, ChatMessagesList } from "./components/ChatMessagesList";

type ChatPageClientProps = {
  userId: string;
  userLabel: string;
};

type ToastType = "success" | "warning" | "error";

type ToastState = {
  text: string;
  type: ToastType;
  persistent: boolean;
  cta?: {
    href: string;
    label: string;
  } | null;
} | null;

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(v ?? "").trim()
  );
}

function markdownToPlainText(markdown: string): string {
  let text = markdown;

  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/^#{1,6}\s*/gm, "");
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  text = text.replace(/\*(.*?)\*/g, "$1");
  text = text.replace(/__(.*?)__/g, "$1");
  text = text.replace(/_(.*?)_/g, "$1");
  text = text.replace(/!\[[^\]]*]\([^)]*\)/g, "");
  text = text.replace(/\[([^\]]+)]\([^)]*\)/g, "$1");
  text = text.replace(/^\s*[-+*]\s+/gm, "• ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

function truncatePdfName(name: string, max = 9) {
  const clean = String(name ?? "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}...`;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MAX_PDF_SIZE_MB = 30;
const OCR_URL = "https://smallpdf.com/pt/pdf-ocr";

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  is_shared?: boolean;
  share_id?: string | null;
  active_pdf_file_id?: string | null;
  pdf_enabled?: boolean;
};

type PdfExtractStatus =
  | "pending"
  | "processing"
  | "ready"
  | "error"
  | "skipped_large"
  | string;

type PdfVectorStatus =
  | "pending"
  | "processing"
  | "ready"
  | "error"
  | "blocked_no_text"
  | string;

type AttachedPdf = {
  id: string;
  fileName: string;
  fileSize: number;
  extractedTextStatus?: PdfExtractStatus | null;
  extractedTextError?: string | null;
  vectorIndexStatus?: PdfVectorStatus | null;
  vectorIndexError?: string | null;
  vectorChunksCount?: number | null;
};

type QuickActionKind = "resumo" | "pontos" | "irregularidade";

type SSEParsed =
  | { event: "meta"; data: any }
  | { event: "delta"; data: { text?: string } }
  | { event: "done"; data: any }
  | {
      event: "error";
      data: {
        error?: string;
        accessBlocked?: boolean;
        accessStatus?: string;
        reason?: string;
      };
    }
  | { event: string; data: any };

type PdfUiStatus =
  | "none"
  | "processing"
  | "ready"
  | "no_text"
  | "technical_error"
  | "large"
  | "indexing"
  | "index_error";

function parseSSEBlock(block: string): SSEParsed | null {
  const lines = block.split("\n").map((l) => l.trimEnd());
  let eventName = "";
  let dataLine = "";

  for (const line of lines) {
    if (line.startsWith("event:")) eventName = line.replace("event:", "").trim();
    else if (line.startsWith("data:")) dataLine = line.replace("data:", "").trim();
  }

  if (!eventName) return null;

  let parsedData: any = null;
  if (dataLine) {
    try {
      parsedData = JSON.parse(dataLine);
    } catch {
      parsedData = dataLine;
    }
  }

  return { event: eventName, data: parsedData } as SSEParsed;
}

async function extractApiChatErrorMessage(res: Response): Promise<string> {
  const fallback = "Erro ao enviar mensagem para a IA.";

  try {
    const text = await res.text();
    if (!text?.trim()) return fallback;

    const trimmed = text.trim();

    try {
      const json = JSON.parse(trimmed);
      const message = String(json?.error ?? "").trim();
      return message || fallback;
    } catch {}

    const blocks = trimmed
      .split("\n\n")
      .map((b) => b.trim())
      .filter(Boolean);

    for (const block of blocks) {
      const parsed = parseSSEBlock(block);
      if (parsed?.event === "error") {
        const msg = String(parsed.data?.error ?? "").trim();
        if (msg) return msg;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function classifyPdfUiStatus(att: AttachedPdf | null): PdfUiStatus {
  if (!att) return "none";

  const e = String(att.extractedTextStatus ?? "").toLowerCase();
  const v = String(att.vectorIndexStatus ?? "").toLowerCase();
  const extractedError = String(att.extractedTextError ?? "").toLowerCase();

  if (e === "pending" || e === "processing") return "processing";
  if (e === "skipped_large") return "large";

  if (e === "error") {
    const noText =
      extractedError.includes("sem texto detectável") ||
      extractedError.includes("sem texto detectavel") ||
      extractedError.includes("faça ocr e reenvie") ||
      extractedError.includes("imagem/escaneado") ||
      extractedError.includes("sem texto detectável para indexação") ||
      extractedError.includes("sem texto detectavel para indexação");

    return noText ? "no_text" : "technical_error";
  }

  if (e === "ready") {
    if (v === "pending" || v === "processing") return "indexing";
    if (v === "error") return "index_error";
    return "ready";
  }

  return "none";
}

function getPdfBadge(att: AttachedPdf | null) {
  const status = classifyPdfUiStatus(att);

  switch (status) {
    case "processing":
      return "Lendo...";
    case "indexing":
      return "Indexando...";
    case "no_text":
      return "Sem texto";
    case "technical_error":
      return "Falha";
    case "large":
      return "Grande";
    case "index_error":
      return "Indexação";
    default:
      return null;
  }
}

function getPdfHint(att: AttachedPdf | null) {
  const status = classifyPdfUiStatus(att);

  switch (status) {
    case "no_text":
      return {
        kind: "ocr" as const,
        text: "Este PDF não tem texto para consulta. Ele pode ser uma imagem ou escaneado. Para ficar pesquisável, recomendo fazer OCR e reenviar.",
      };
    case "technical_error":
      return {
        kind: "info" as const,
        text: "O PDF foi anexado, mas houve uma falha técnica no processamento. Você pode tentar reenviar ou reprocessar o arquivo.",
      };
    case "large":
      return {
        kind: "info" as const,
        text: "O PDF é grande demais para processamento automático completo. Se possível, envie uma versão menor ou com OCR.",
      };
    default:
      return null;
  }
}

export default function ChatPageClient({
  userId,
  userLabel,
}: ChatPageClientProps) {
  const [supabase] = useState(() =>
    createBrowserClient(supabaseUrl, supabaseAnonKey)
  );

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const activeConversationIdRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [attachedPdfs, setAttachedPdfs] = useState<AttachedPdf[]>([]);
  const [activePdfId, setActivePdfId] = useState<string | null>(null);
  const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showPdfQuickActions, setShowPdfQuickActions] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const [showPdfHint, setShowPdfHint] = useState(false);

  const justCreatedConversationRef = useRef(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const stoppedByUserRef = useRef(false);
  const streamingAssistantIdRef = useRef<string | null>(null);

  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [actionToast, setActionToast] = useState<{
    messageId: string;
    text: string;
  } | null>(null);
  const actionToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [access, setAccess] = useState<FrontendAccessSummary | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  function clearToastTimer() {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }

  function hideToast() {
    clearToastTimer();
    setToast(null);
  }

  function showToast(
    text: string,
    options?: {
      type?: ToastType;
      persistent?: boolean;
      durationMs?: number;
      cta?: {
        href: string;
        label: string;
      } | null;
    }
  ) {
    const type = options?.type ?? "success";
    const persistent =
      options?.persistent ?? (type === "error" || type === "warning");
    const durationMs = options?.durationMs ?? 2500;

    clearToastTimer();

    setToast({
      text,
      type,
      persistent,
      cta: options?.cta ?? null,
    });

    if (!persistent) {
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, durationMs);
    }
  }

  function showActionToast(messageId: string, text: string) {
    if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
    setActionToast({ messageId, text });
    actionToastTimerRef.current = setTimeout(() => setActionToast(null), 2500);
  }

  const loadAccess = useCallback(async () => {
    try {
      setAccessLoading(true);
      const data = await fetchAccessSummary();
      setAccess(data);
    } catch (error) {
      console.error("Erro ao carregar acesso no frontend:", error);
      setAccess(null);
    } finally {
      setAccessLoading(false);
    }
  }, []);

  const isBlocked = useMemo(() => {
    if (accessLoading) return false;
    return !canUseAiFeatures(access);
  }, [access, accessLoading]);

  const blockedMessage = useMemo(() => {
    if (accessLoading) return "";
    return getBlockedAccessMessage(access);
  }, [access, accessLoading]);

  const blockedCta = useMemo(() => {
    if (accessLoading) return null;
    return getBlockedAccessCta(access?.access_status);
  }, [access, accessLoading]);

  const attachedPdf = useMemo(() => {
    if (!attachedPdfs.length) return null;
    if (!activePdfId) return attachedPdfs[attachedPdfs.length - 1] ?? null;

    return (
      attachedPdfs.find((pdf) => pdf.id === activePdfId) ??
      attachedPdfs[attachedPdfs.length - 1] ??
      null
    );
  }, [attachedPdfs, activePdfId]);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (isBlocked) {
      setShowPdfQuickActions(false);
    }
  }, [isBlocked]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!quickActionsRef.current) return;
      if (!quickActionsRef.current.contains(event.target as Node)) {
        setShowPdfQuickActions(false);
      }
    }

    if (showPdfQuickActions) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showPdfQuickActions]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearToastTimer();
      if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
    };
  }, []);

  function handleStop() {
    stoppedByUserRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsSending(false);

    const targetId = streamingAssistantIdRef.current;

    setMessages((prev) => {
      const idx = targetId ? prev.findIndex((m) => m.id === targetId) : -1;
      const fallbackIdx =
        idx === -1
          ? [...prev].reverse().findIndex((m) => m.role === "assistant")
          : -1;
      const realIdx =
        idx !== -1 ? idx : fallbackIdx === -1 ? -1 : prev.length - 1 - fallbackIdx;

      if (realIdx === -1) return prev;

      const m = prev[realIdx];
      if (m.role !== "assistant") return prev;

      const marker = "\n\n*(Resposta interrompida pelo usuário.)*";
      const already = (m.content || "").includes(
        "Resposta interrompida pelo usuário"
      );

      const next = [...prev];
      next[realIdx] = {
        ...m,
        content: already ? m.content : (m.content || "").trimEnd() + marker,
      };
      return next;
    });
  }

  const fetchPdfStatus = useCallback(
    async (pdfFileId: string, conversationId: string) => {
      const { data, error } = await supabase
        .from("pdf_files")
        .select(
          "id, file_name, file_size, extracted_text_status, extracted_text_error, vector_index_status, vector_index_error, vector_chunks_count"
        )
        .eq("id", pdfFileId)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar status do PDF:", error.message);
        return null;
      }
      if (!data) return null;

      return {
        id: String((data as any).id),
        fileName: String((data as any).file_name ?? "PDF"),
        fileSize: Number((data as any).file_size ?? 0),
        extractedTextStatus: (data as any).extracted_text_status ?? null,
        extractedTextError: (data as any).extracted_text_error ?? null,
        vectorIndexStatus: (data as any).vector_index_status ?? null,
        vectorIndexError: (data as any).vector_index_error ?? null,
        vectorChunksCount:
          typeof (data as any).vector_chunks_count === "number"
            ? (data as any).vector_chunks_count
            : null,
      } as AttachedPdf;
    },
    [supabase, userId]
  );

  const loadConversationPdfs = useCallback(
    async (conversationId: string) => {
      const { data: conv, error: convError } = await supabase
        .from("conversations")
        .select("id, active_pdf_file_id, pdf_enabled")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (convError) {
        console.error("Erro ao carregar conversa (PDF state):", convError.message);
        setAttachedPdfs([]);
        setActivePdfId(null);
        setSelectedPdfIds([]);
        setShowPdfHint(false);
        return;
      }

      if (activeConversationIdRef.current !== conversationId) return;

      const pdfEnabled = Boolean((conv as any)?.pdf_enabled);
      const currentActivePdfId =
        ((conv as any)?.active_pdf_file_id as string | null | undefined) ?? null;

      if (!pdfEnabled) {
        setAttachedPdfs([]);
        setActivePdfId(null);
        setSelectedPdfIds([]);
        setShowPdfHint(false);
        return;
      }

      const { data: links, error: linksError } = await supabase
        .from("conversation_pdf_links")
        .select("pdf_file_id, is_active, created_at")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (linksError) {
        console.error("Erro ao carregar vínculos dos PDFs:", linksError.message);
        setAttachedPdfs([]);
        setActivePdfId(null);
        setSelectedPdfIds([]);
        setShowPdfHint(false);
        return;
      }

      const pdfIds = Array.from(
        new Set(
          (links ?? [])
            .map((item: any) => String(item?.pdf_file_id ?? "").trim())
            .filter(Boolean)
        )
      );

      if (!pdfIds.length) {
        setAttachedPdfs([]);
        setActivePdfId(null);
        setSelectedPdfIds([]);
        setShowPdfHint(false);
        return;
      }

      const statusList = await Promise.all(
        pdfIds.map((pdfId) => fetchPdfStatus(pdfId, conversationId))
      );

      if (activeConversationIdRef.current !== conversationId) return;

      const validPdfs = statusList.filter(Boolean) as AttachedPdf[];
      setAttachedPdfs(validPdfs);

      const activeFromLinks =
        (links ?? []).find((item: any) => item?.is_active === true)?.pdf_file_id ?? null;

      const resolvedActivePdfId =
        String(
          currentActivePdfId ??
            activeFromLinks ??
            validPdfs[validPdfs.length - 1]?.id ??
            ""
        ).trim() || null;

      setActivePdfId(resolvedActivePdfId);

      setSelectedPdfIds((prev) => {
        const validIds = validPdfs.map((pdf) => pdf.id);
        const validSet = new Set(validIds);
        const filtered = prev.filter((id) => validSet.has(id));
        if (filtered.length > 0) return filtered;
        return validIds;
      });

      const activePdfResolved =
        validPdfs.find((pdf) => pdf.id === resolvedActivePdfId) ??
        validPdfs[validPdfs.length - 1] ??
        null;

      if (!activePdfResolved) {
        setShowPdfHint(false);
        return;
      }

      const uiStatus = classifyPdfUiStatus(activePdfResolved);
      setShowPdfHint(
        uiStatus === "no_text" ||
          uiStatus === "technical_error" ||
          uiStatus === "large"
      );
    },
    [fetchPdfStatus, supabase, userId]
  );

  const setPdfAsActive = useCallback(
    async (conversationId: string, pdfFileId: string, options?: { silent?: boolean }) => {
      const { error: deactivateError } = await supabase
        .from("conversation_pdf_links")
        .update({ is_active: false } as any)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      if (deactivateError) {
        console.error("Erro ao desativar PDFs anteriores da conversa:", deactivateError.message);

        if (!options?.silent) {
          showToast("Não foi possível definir o PDF ativo.", {
            type: "error",
            persistent: true,
          });
        }
        return false;
      }

      const { error: activateError } = await supabase
        .from("conversation_pdf_links")
        .update({ is_active: true } as any)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .eq("pdf_file_id", pdfFileId);

      if (activateError) {
        console.error("Erro ao ativar o PDF atual da conversa:", activateError.message);

        if (!options?.silent) {
          showToast("Não foi possível definir o PDF ativo.", {
            type: "error",
            persistent: true,
          });
        }
        return false;
      }

      const { error: conversationUpdateError } = await supabase
        .from("conversations")
        .update({
          active_pdf_file_id: pdfFileId,
          pdf_enabled: true,
        } as any)
        .eq("id", conversationId)
        .eq("user_id", userId);

      if (conversationUpdateError) {
        console.error(
          "Erro ao atualizar conversa com PDF ativo:",
          conversationUpdateError.message
        );

        if (!options?.silent) {
          showToast("Não foi possível salvar o PDF ativo.", {
            type: "error",
            persistent: true,
          });
        }
        return false;
      }

      return true;
    },
    [supabase, userId]
  );

  const pollPdfUntilStable = useCallback(
    async (pdfFileId: string, conversationId: string) => {
      const start = Date.now();
      const timeoutMs = 25000;
      const intervalMs = 1500;

      while (Date.now() - start < timeoutMs) {
        if (activeConversationIdRef.current !== conversationId) return;

        const status = await fetchPdfStatus(pdfFileId, conversationId);
        if (status) {
          setAttachedPdfs((prev) => {
            const exists = prev.some((item) => item.id === status.id);
            if (!exists) return [...prev, status];
            return prev.map((item) => (item.id === status.id ? status : item));
          });

          if (activePdfId === pdfFileId) {
            const uiStatus = classifyPdfUiStatus(status);
            if (
              uiStatus === "no_text" ||
              uiStatus === "technical_error" ||
              uiStatus === "large"
            ) {
              setShowPdfHint(true);
            }
          }
        }

        const e = String(status?.extractedTextStatus ?? "").toLowerCase();
        const v = String(status?.vectorIndexStatus ?? "").toLowerCase();

        const extractedStable = e && !["pending", "processing"].includes(e);
        const vectorStable =
          e !== "ready" ? true : v && !["pending", "processing"].includes(v);

        if (extractedStable && vectorStable) break;

        await new Promise((r) => setTimeout(r, intervalMs));
      }
    },
    [fetchPdfStatus, activePdfId]
  );

  useEffect(() => {
    async function loadConversations() {
      try {
        const { data, error } = await supabase
          .from("conversations")
          .select("id, title, created_at, is_shared, share_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro ao carregar conversas:", error.message);
          return;
        }

        const convs = (data ?? []) as Conversation[];
        setConversations(convs);

        if (convs.length > 0 && !activeConversationIdRef.current) {
          setActiveConversationId(convs[0].id);
          activeConversationIdRef.current = convs[0].id;
        }
      } finally {
        setLoadingConversations(false);
      }
    }

    loadConversations();
  }, [supabase, userId]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setAttachedPdfs([]);
      setActivePdfId(null);
      setSelectedPdfIds([]);
      setShowPdfQuickActions(false);
      setActionToast(null);
      setShowPdfHint(false);
      return;
    }

    if (justCreatedConversationRef.current) {
      justCreatedConversationRef.current = false;
      return;
    }

    setMessages([]);
    setLoadingMessages(true);
    setActionToast(null);

    setAttachedPdfs([]);
    setActivePdfId(null);
    setSelectedPdfIds([]);
    setShowPdfQuickActions(false);
    setShowPdfHint(false);

    const currentConversationId = activeConversationId;

    async function loadMessages() {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", currentConversationId)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Erro ao carregar mensagens:", error.message);
          return;
        }

        const msgs =
          (data ?? []).map((m: any) => ({
            id: m.id as string,
            role: m.role as "user" | "assistant",
            content: m.content as string,
            created_at: m.created_at as string,
          })) || [];

        if (activeConversationIdRef.current !== currentConversationId) return;
        setMessages(msgs);
      } finally {
        if (activeConversationIdRef.current === currentConversationId) {
          setLoadingMessages(false);
        }
      }
    }

    async function loadAttachedPdf() {
      try {
        await loadConversationPdfs(currentConversationId);
      } catch (e) {
        console.error("Erro inesperado ao carregar PDFs anexados:", e);
        setAttachedPdfs([]);
        setActivePdfId(null);
        setSelectedPdfIds([]);
        setShowPdfHint(false);
      }
    }

    loadMessages();
    loadAttachedPdf();
  }, [activeConversationId, supabase, userId, loadConversationPdfs]);

  async function createConversation(
    shouldResetState: boolean = false
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title: "Nova conversa" })
        .select("id, title, created_at, is_shared, share_id")
        .single();

      if (error) {
        console.error("Erro ao criar conversa:", error.message);
        showToast("Não foi possível criar a conversa.", {
          type: "error",
          persistent: true,
        });
        return null;
      }

      const newConv = data as Conversation;
      setConversations((prev) => [newConv, ...prev]);

      setActiveConversationId(newConv.id);
      activeConversationIdRef.current = newConv.id;

      justCreatedConversationRef.current = true;

      if (shouldResetState) {
        setMessages([]);
        setAttachedPdfs([]);
        setActivePdfId(null);
        setSelectedPdfIds([]);
        setShowPdfQuickActions(false);
        setActionToast(null);
        setShowPdfHint(false);
      }

      return newConv.id;
    } catch (err) {
      console.error("Erro inesperado ao criar conversa:", err);
      showToast("Erro inesperado ao criar conversa.", {
        type: "error",
        persistent: true,
      });
      return null;
    }
  }

  async function handleNewConversation() {
    if (isBlocked) {
      showToast(blockedMessage, {
        type: "warning",
        persistent: true,
        cta: blockedCta,
      });
      return;
    }

    abortRef.current?.abort();
    abortRef.current = null;
    stoppedByUserRef.current = false;
    streamingAssistantIdRef.current = null;

    setActionToast(null);
    await createConversation(true);
    setIsMobileSidebarOpen(false);
  }

  function handleSelectConversation(id: string) {
    stoppedByUserRef.current = false;
    streamingAssistantIdRef.current = null;

    abortRef.current?.abort();
    abortRef.current = null;

    setActiveConversationId(id);
    activeConversationIdRef.current = id;

    setMessages([]);
    setLoadingMessages(true);

    setAttachedPdfs([]);
    setActivePdfId(null);
    setSelectedPdfIds([]);
    setShowPdfQuickActions(false);
    setIsMobileSidebarOpen(false);
    setShowPdfHint(false);

    setActionToast(null);
  }

  async function handleDeleteConversation(id: string) {
    const confirmDelete = window.confirm(
      "Tem certeza que deseja excluir esta conversa?"
    );
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Erro ao excluir conversa:", error.message);
      showToast("Não foi possível excluir a conversa.", {
        type: "error",
        persistent: true,
      });
      return;
    }

    setConversations((prev) => prev.filter((c) => c.id !== id));

    if (activeConversationId === id) {
      setActiveConversationId(null);
      activeConversationIdRef.current = null;

      setMessages([]);
      setAttachedPdfs([]);
      setActivePdfId(null);
      setSelectedPdfIds([]);
      setShowPdfQuickActions(false);
      setActionToast(null);
      setShowPdfHint(false);
    }

    showToast("Conversa excluída.", {
      type: "success",
      persistent: false,
      durationMs: 2500,
    });
  }

  async function ensureConversationId(): Promise<string | null> {
    if (activeConversationIdRef.current) return activeConversationIdRef.current;
    const created = await createConversation(false);
    return created;
  }

  function getEffectivePdfSelectionForChat() {
    if (!attachedPdfs.length) {
      return {
        pdfMode: "all" as const,
        selectedPdfIds: [] as string[],
      };
    }

    return {
      pdfMode: "selected" as const,
      selectedPdfIds,
    };
  }

  async function handleSend(messageText: string) {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    if (isBlocked) {
      showToast(blockedMessage, {
        type: "warning",
        persistent: true,
        cta: blockedCta,
      });
      return;
    }

    const pdfSelection = getEffectivePdfSelectionForChat();

    if (attachedPdfs.length > 0 && pdfSelection.selectedPdfIds.length === 0) {
      showToast("Selecione pelo menos 1 PDF para conversar no chat.", {
        type: "warning",
        persistent: true,
      });
      return;
    }

    stoppedByUserRef.current = false;
    streamingAssistantIdRef.current = null;

    abortRef.current?.abort();
    abortRef.current = null;

    const conversationId = await ensureConversationId();
    if (!conversationId) return;

    const tempUserId = `temp-user-${Date.now()}`;
    const tempAssistantId = `temp-assistant-${Date.now() + 1}`;
    streamingAssistantIdRef.current = tempAssistantId;

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: trimmed },
      { id: tempAssistantId, role: "assistant", content: "" },
    ]);
    setIsSending(true);

    try {
      const existingConv = conversations.find((c) => c.id === conversationId);
      const isDefaultTitle =
        !existingConv ||
        !existingConv.title ||
        existingConv.title.trim().length === 0 ||
        existingConv.title.trim().toLowerCase() === "nova conversa";

      if (isDefaultTitle) {
        const base = trimmed.replace(/\s+/g, " ");
        const maxLen = 60;
        const newTitle =
          base.length > maxLen
            ? base.slice(0, maxLen).trimEnd() + "..."
            : base;

        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, title: newTitle } : c
          )
        );

        supabase
          .from("conversations")
          .update({ title: newTitle })
          .eq("id", conversationId)
          .eq("user_id", userId)
          .then(({ error }: any) => {
            if (error) console.error("Erro ao atualizar título:", error.message);
          });
      }
    } catch (err) {
      console.error("Erro ao atualizar título da conversa (pré-stream):", err);
    }

    try {
      const ac = new AbortController();
      abortRef.current = ac;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          conversationId,
          message: trimmed,
          pdfMode: pdfSelection.pdfMode,
          selectedPdfIds: pdfSelection.selectedPdfIds,
        }),
      });

      if (!res.ok) {
        const apiErrorMessage = await extractApiChatErrorMessage(res);
        console.error("Erro ao chamar /api/chat:", apiErrorMessage);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantId
              ? { ...m, content: `Erro: ${apiErrorMessage}` }
              : m
          )
        );

        showToast(apiErrorMessage, {
          type: "error",
          persistent: true,
        });
        return;
      }

      if (!res.body) {
        showToast("Erro ao enviar mensagem para a IA.", {
          type: "error",
          persistent: true,
        });
        setMessages((prev) =>
          prev.filter((m) => m.id !== tempUserId && m.id !== tempAssistantId)
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);

          if (!block) continue;

          const parsed = parseSSEBlock(block);
          if (!parsed) continue;

          if (parsed.event === "meta") {
            const userMessage = parsed.data?.userMessage;
            if (userMessage?.id) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempUserId
                    ? {
                        id: userMessage.id,
                        role: "user",
                        content: userMessage.content ?? trimmed,
                        created_at: userMessage.created_at,
                      }
                    : m
                )
              );
            }
          }

          if (parsed.event === "delta") {
            const deltaText = parsed.data?.text ?? "";
            if (deltaText) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, content: (m.content || "") + deltaText }
                    : m
                )
              );
            }
          }

          if (parsed.event === "done") {
            const assistantMessage = parsed.data?.assistantMessage;
            if (assistantMessage?.id) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? {
                        id: assistantMessage.id,
                        role: "assistant",
                        content: assistantMessage.content ?? m.content ?? "",
                        created_at: assistantMessage.created_at,
                      }
                    : m
                )
              );
            }
          }

          if (parsed.event === "error") {
            const msg = parsed.data?.error || "Erro ao gerar a resposta.";
            console.error("[SSE error]", msg);

            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId ? { ...m, content: `Erro: ${msg}` } : m
              )
            );

            showToast(msg, {
              type: "error",
              persistent: true,
            });
          }
        }
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Erro inesperado ao enviar mensagem para IA:", error);
        showToast("Erro ao enviar mensagem para a IA.", {
          type: "error",
          persistent: true,
        });
        setMessages((prev) =>
          prev.filter((m) => m.id !== tempUserId && m.id !== tempAssistantId)
        );
      }
    } finally {
      abortRef.current = null;
      setIsSending(false);
      streamingAssistantIdRef.current = null;
      stoppedByUserRef.current = false;
      loadAccess().catch(() => {});
    }
  }

  async function handleRegenerateLast(lastUserMessage: string) {
    if (isBlocked) {
      showToast(blockedMessage, {
        type: "warning",
        persistent: true,
        cta: blockedCta,
      });
      return;
    }

    await handleSend(lastUserMessage);
  }

  async function handlePdfQuickAction(kind: QuickActionKind) {
    if (isBlocked) {
      showToast(blockedMessage, {
        type: "warning",
        persistent: true,
        cta: blockedCta,
      });
      return;
    }

    if (!attachedPdf) {
      showToast("Anexe um PDF antes de usar as ações rápidas.", {
        type: "warning",
        persistent: true,
      });
      return;
    }

    let prompt = "";

    switch (kind) {
      case "resumo":
        prompt = `
Com base no PDF ativo anexado ( ${attachedPdf.fileName} ). Faça um resumo objetivo e didático, em linguagem simples, destacando:
- Contexto geral do documento;
- Principais pontos normativos ou orientações;
- Impactos práticos para a administração pública municipal.

Organize a resposta em tópicos e parágrafos curtos.
`.trim();
        break;

      case "pontos":
        prompt = `
Considerando apenas o conteúdo do PDF ativo anexado ( ${attachedPdf.fileName} ). Liste os principais PONTOS DE ATENÇÃO, focando especialmente em:
- Obrigações principais;
- Prazos relevantes;
- Riscos para a administração pública municipal em caso de descumprimento.

Explique de forma clara, em linguagem acessível, e organize em tópicos.
`.trim();
        break;

      case "irregularidade":
        prompt = `
Com base no conteúdo do PDF ativo anexado ( ${attachedPdf.fileName} ). Identifique possíveis IRREGULARIDADES, inconsistências ou pontos de atenção jurídica,
tanto formais quanto materiais, que possam gerar risco para a administração pública municipal.
Aponte:
- Dispositivos que possam gerar dúvidas ou conflitos com a legislação vigente;
- Riscos de responsabilização do gestor;
- Recomendações de cautela.

Organize a resposta em tópicos, com explicações objetivas.
`.trim();
        break;
    }

    await handleSend(prompt);
  }

  async function handleCopyAnswer(messageId: string) {
    try {
      await copyMessageToClipboard(messageId);
      showActionToast(messageId, "Resposta copiada.");
      return;
    } catch (err) {
      console.warn("[copy] Falhou HTML copy, tentando fallback texto...", err);
    }

    try {
      const msg = messages.find(
        (m) => m.id === messageId && m.role === "assistant"
      );
      if (!msg) throw new Error("Mensagem não encontrada para copiar.");

      const plainText = markdownToPlainText(msg.content);
      await navigator.clipboard.writeText(plainText);

      showActionToast(messageId, "Resposta copiada.");
    } catch (err) {
      console.error("Erro ao copiar resposta:", err);
      showToast("Não foi possível copiar a resposta.", {
        type: "error",
        persistent: true,
      });
    }
  }

  async function handleShareConversation(conversationId: string, messageId: string) {
    const targetConversationId = String(conversationId ?? "").trim();
    const targetMessageId = String(messageId ?? "").trim();

    if (!targetConversationId || !isUuid(targetConversationId)) {
      showToast("Conversa inválida para compartilhar.", {
        type: "error",
        persistent: true,
      });
      return;
    }
    if (!targetMessageId || !isUuid(targetMessageId)) {
      showToast("Mensagem inválida para compartilhar.", {
        type: "error",
        persistent: true,
      });
      return;
    }

    try {
      const res = await fetch("/api/public/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: targetConversationId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("[share/create] erro:", data);
        showToast(String(data?.error ?? "Não foi possível gerar o link público."), {
          type: "error",
          persistent: true,
        });
        return;
      }

      const shareId = String(data?.shareId ?? "").trim();
      if (!shareId) {
        showToast("Não foi possível gerar o link público.", {
          type: "error",
          persistent: true,
        });
        return;
      }

      const url = `${window.location.origin}/p/${shareId}?m=${encodeURIComponent(
        targetMessageId
      )}`;
      await navigator.clipboard.writeText(url);

      showActionToast(messageId, "Link público copiado.");
    } catch (err) {
      console.error("Erro inesperado ao compartilhar:", err);
      showToast("Erro inesperado ao gerar link público.", {
        type: "error",
        persistent: true,
      });
    }
  }

  function handlePdfButtonClick() {
    if (isBlocked) {
      showToast(blockedMessage, {
        type: "warning",
        persistent: true,
        cta: blockedCta,
      });
      return;
    }

    fileInputRef.current?.click();
  }

  async function removeUploadedPdfFromStorage(storagePath: string) {
    try {
      const { error } = await (supabase as any).storage
        .from("pdf-files")
        .remove([storagePath]);

      if (error) {
        console.error("[Chat] Falha ao remover PDF órfão do storage:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[Chat] Erro inesperado ao remover PDF órfão do storage:", error);
      return false;
    }
  }

  async function handlePdfChange(e: ChangeEvent<HTMLInputElement>) {
    if (isBlocked) {
      showToast(blockedMessage, {
        type: "warning",
        persistent: true,
        cta: blockedCta,
      });
      e.target.value = "";
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = MAX_PDF_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      showToast(`PDF grande (${sizeMb} MB). Limite atual: ${MAX_PDF_SIZE_MB} MB.`, {
        type: "warning",
        persistent: true,
      });
      e.target.value = "";
      return;
    }

    setIsUploadingPdf(true);
    setShowPdfHint(false);

    let uploadedStoragePath: string | null = null;

    try {
      const conversationId = await ensureConversationId();
      if (!conversationId) {
        showToast("Não foi possível criar uma conversa para vincular o PDF.", {
          type: "error",
          persistent: true,
        });
        setIsUploadingPdf(false);
        return;
      }

      const safeName = file.name.normalize("NFKD").replace(/[^\w.-]+/g, "_");
      const storagePath = `${conversationId}/${Date.now()}-${safeName}`;

      const { data: storageData, error: storageError } = await (supabase as any).storage
        .from("pdf-files")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/pdf",
        });

      if (storageError || !storageData) {
        console.error("[Chat] Erro ao enviar PDF para o Supabase Storage:", storageError);
        showToast("Não foi possível enviar o PDF. Tente novamente.", {
          type: "error",
          persistent: true,
        });
        return;
      }

      const finalStoragePath = storageData.path ?? storagePath;
      uploadedStoragePath = finalStoragePath;

      const res = await fetch("/api/upload-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          fileName: file.name,
          fileSize: file.size,
          storagePath: finalStoragePath,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Erro ao registrar PDF no banco:", errorText);

        if (uploadedStoragePath) {
          await removeUploadedPdfFromStorage(uploadedStoragePath);
          uploadedStoragePath = null;
        }

        let apiMessage = "PDF enviado, mas falhou ao registrar no histórico.";
        let apiAccessStatus: string | null = null;

        try {
          const parsed = JSON.parse(errorText);
          const parsedMessage = String(parsed?.error ?? "").trim();
          if (parsedMessage) {
            apiMessage = parsedMessage;
          }

          apiAccessStatus =
            typeof parsed?.accessStatus === "string" ? parsed.accessStatus : null;
        } catch {}

        const lowerMessage = apiMessage.toLowerCase();
        const isCommercialBlock =
          lowerMessage.includes("limite de") ||
          lowerMessage.includes("período de teste expirou") ||
          lowerMessage.includes("assinatura expirou") ||
          lowerMessage.includes("não permite enviar novos pdfs");

        const isPdfLimitReached =
          lowerMessage.includes("limite de") &&
          lowerMessage.includes("pdf");

        const toastCta = apiAccessStatus
          ? getBlockedAccessCta(
              apiAccessStatus as any,
              isPdfLimitReached ? "pdf_limit_reached" : "general_block"
            )
          : null;

        showToast(apiMessage, {
          type: isCommercialBlock ? "warning" : "error",
          persistent: true,
          cta: isCommercialBlock ? toastCta : null,
        });
        return;
      }

      const data = (await res.json()) as {
        id: string;
        fileName: string;
        fileSize: number;
        warning?: string;
      };

      const status = await fetchPdfStatus(data.id, conversationId);
      const nextPdf: AttachedPdf = status ?? {
        id: data.id,
        fileName: data.fileName,
        fileSize: data.fileSize,
      };

      setAttachedPdfs((prev) => {
        const filtered = prev.filter((item) => item.id !== nextPdf.id);
        return [...filtered, nextPdf];
      });

      setActivePdfId(data.id);
      await loadConversationPdfs(conversationId);

      fetch("/api/pdf/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfFileId: data.id }),
      }).catch(() => {});

      pollPdfUntilStable(data.id, conversationId).catch(() => {});
      loadAccess().catch(() => {});

      uploadedStoragePath = null;

      if (data.warning) {
        console.warn("[upload-pdf] warning:", data.warning);
        showToast("PDF anexado (atenção: verifique colunas do banco).", {
          type: "warning",
          persistent: true,
        });
      } else {
        showToast("PDF anexado.", {
          type: "success",
          persistent: false,
          durationMs: 2500,
        });
      }
    } catch (error) {
      console.error("Erro inesperado ao enviar PDF:", error);

      if (uploadedStoragePath) {
        await removeUploadedPdfFromStorage(uploadedStoragePath);
      }

      showToast("Não foi possível enviar o PDF.", {
        type: "error",
        persistent: true,
      });
    } finally {
      e.target.value = "";
      setIsUploadingPdf(false);
    }
  }

  async function handleRemovePdf(pdfId: string) {
    if (isBlocked) {
      showToast(blockedMessage, {
        type: "warning",
        persistent: true,
        cta: blockedCta,
      });
      return;
    }

    try {
      const conversationId = activeConversationIdRef.current;
      if (!conversationId) {
        setAttachedPdfs([]);
        setActivePdfId(null);
        setSelectedPdfIds([]);
        setShowPdfQuickActions(false);
        setShowPdfHint(false);
        return;
      }

      const res = await fetch("/api/pdf/detach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, pdfFileId: pdfId }),
      });

      if (!res.ok) {
        console.error("Falha ao desanexar PDF:", await res.text());
        showToast("Não foi possível desanexar o PDF.", {
          type: "error",
          persistent: true,
        });
        return;
      }

      const data = (await res.json().catch(() => null)) as
        | {
            activePdfFileId?: string | null;
          }
        | null;

      const remaining = attachedPdfs.filter((pdf) => pdf.id !== pdfId);
      setAttachedPdfs(remaining);
      setSelectedPdfIds((prev) => prev.filter((id) => id !== pdfId));
      setShowPdfQuickActions(false);

      const nextActivePdfId =
        typeof data?.activePdfFileId === "string" && data.activePdfFileId.trim()
          ? data.activePdfFileId
          : remaining[remaining.length - 1]?.id ?? null;

      setActivePdfId(nextActivePdfId);

      const nextActivePdf =
        remaining.find((pdf) => pdf.id === nextActivePdfId) ??
        remaining[remaining.length - 1] ??
        null;

      const uiStatus = classifyPdfUiStatus(nextActivePdf);
      setShowPdfHint(
        uiStatus === "no_text" ||
          uiStatus === "technical_error" ||
          uiStatus === "large"
      );

      await loadConversationPdfs(conversationId);

      showToast("PDF desanexado.", {
        type: "success",
        persistent: false,
        durationMs: 2500,
      });
    } catch (e) {
      console.error("Erro ao desanexar PDF:", e);
      showToast("Erro ao desanexar o PDF.", {
        type: "error",
        persistent: true,
      });
    }
  }

  async function handleDoOcr() {
    if (isBlocked) {
      showToast(blockedMessage, {
        type: "warning",
        persistent: true,
        cta: blockedCta,
      });
      return;
    }

    const conversationId = activeConversationIdRef.current;
    const currentAttachedPdf = attachedPdf;

    if (conversationId && currentAttachedPdf?.id) {
      try {
        const res = await fetch("/api/pdf/detach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            pdfFileId: currentAttachedPdf.id,
          }),
        });

        if (!res.ok) {
          console.error("Falha ao desanexar PDF:", await res.text());
          showToast("Não consegui desanexar o PDF agora. Tente novamente.", {
            type: "error",
            persistent: true,
          });
          return;
        }

        await loadConversationPdfs(conversationId);
      } catch (e) {
        console.error("Erro ao desanexar PDF:", e);
        showToast("Não consegui desanexar o PDF agora. Tente novamente.", {
          type: "error",
          persistent: true,
        });
        return;
      }
    }

    setShowPdfQuickActions(false);
    setShowPdfHint(false);

    const w = window.open(OCR_URL, "_blank", "noopener,noreferrer");
    if (!w) {
      showToast("Pop-up bloqueado. Permita pop-ups ou abra: smallpdf.com/pt/pdf-ocr", {
        type: "warning",
        persistent: true,
      });
    }
  }

  function handleDismissPdfHint() {
    setShowPdfHint(false);
  }

  function toggleSelectedPdf(pdfId: string) {
    setSelectedPdfIds((prev) => {
      if (prev.includes(pdfId)) {
        return prev.filter((id) => id !== pdfId);
      }
      return [...prev, pdfId];
    });
  }

  const toastStyles = useMemo(() => {
    if (!toast) {
      return {
        container: "",
        button: "",
      };
    }

    switch (toast.type) {
      case "success":
        return {
          container:
            "border-emerald-300/30 bg-emerald-500/10 text-emerald-100",
          button: "text-emerald-100/80 hover:text-emerald-50",
        };
      case "warning":
        return {
          container: "border-amber-300/30 bg-amber-500/10 text-amber-100",
          button: "text-amber-100/80 hover:text-amber-50",
        };
      case "error":
      default:
        return {
          container: "border-red-300/30 bg-red-500/10 text-red-100",
          button: "text-red-100/80 hover:text-red-50",
        };
    }
  }, [toast]);

  const renderMain = () => {
    const hint = getPdfHint(attachedPdf);

    const showHint =
      !!attachedPdf &&
      !!hint &&
      showPdfHint &&
      (hint.kind === "ocr" || hint.kind === "info");

    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {messages.length > 0 ? (
            <ChatMessagesList
              messages={messages}
              onCopyAnswer={handleCopyAnswer}
              onShareConversation={handleShareConversation}
              onRegenerateLast={handleRegenerateLast}
              onDoOcr={handleDoOcr}
              isSending={isSending}
              variant="chat"
              activeConversationId={activeConversationId}
              actionToast={actionToast}
              isBlocked={isBlocked}
              blockedMessage={blockedMessage}
              blockedCta={blockedCta}
            />
          ) : loadingMessages && activeConversationId ? (
            <div className="flex h-full items-center justify-center text-sm text-white">
              Carregando conversa...
            </div>
          ) : (
            <ChatEmptyState />
          )}
        </div>

        <div className="border-t border-slate-700 bg-[#2f4f67] px-6 py-3">
          <div className="mx-auto w-full max-w-3xl">
            {toast && (
              <div
                className={`mb-2 rounded-xl border px-3 py-2 text-[12px] ${toastStyles.container}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="leading-snug">{toast.text}</div>

                    {toast.cta && (
                      <div className="mt-3">
                        <a
                          href={toast.cta.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-[11px] font-semibold text-slate-950 transition hover:bg-amber-400"
                        >
                          {toast.cta.label}
                        </a>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={hideToast}
                    className={`shrink-0 text-[14px] font-bold leading-none ${toastStyles.button}`}
                    aria-label="Fechar aviso"
                    title="Fechar"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {isBlocked && (
              <div className="mb-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-3 text-[12px] text-amber-100">
                <div className="font-semibold">Acesso bloqueado para novas ações</div>
                <div className="mt-1">{blockedMessage}</div>

                {blockedCta && (
                  <div className="mt-3">
                    <a
                      href={blockedCta.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-[11px] font-semibold text-slate-950 transition hover:bg-amber-400"
                    >
                      {blockedCta.label}
                    </a>
                  </div>
                )}
              </div>
            )}

            {showHint && hint && (
              <div className="mb-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-slate-100">
                <div className="leading-snug">{hint.text}</div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {hint.kind === "ocr" && (
                    <button
                      type="button"
                      onClick={handleDoOcr}
                      className="rounded-full bg-[#1b3a56] px-3 py-2 text-[11px] font-semibold text-slate-100 hover:bg-[#223f57]"
                    >
                      FAZER OCR
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDismissPdfHint}
                    className="rounded-full bg-[#1b3a56] px-3 py-2 text-[11px] font-semibold text-slate-100 hover:bg-[#223f57]"
                  >
                    CONTINUAR
                  </button>
                </div>
              </div>
            )}

            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handlePdfButtonClick}
                disabled={isBlocked || accessLoading || isUploadingPdf}
                className={`inline-flex h-10 shrink-0 items-center justify-center rounded-full px-4 text-[10px] font-semibold ${
                  isBlocked || accessLoading || isUploadingPdf
                    ? "cursor-not-allowed bg-[#1b3a56] text-slate-400 opacity-60"
                    : "bg-[#1b3a56] text-slate-100 hover:bg-[#223f57]"
                }`}
              >
                ANEXAR PDF
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePdfChange}
              />

              <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap pb-1">
                <div className="flex w-max items-center gap-2 pr-1">
                  {attachedPdfs.map((pdf) => {
                    const isActivePdf = pdf.id === attachedPdf?.id;
                    const isSelectedPdf = selectedPdfIds.includes(pdf.id);
                    const itemBadge = getPdfBadge(pdf);

                    return (
                      <div
                        key={pdf.id}
                        className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-[10px] ${
                          isActivePdf
                            ? "border-white/40 bg-[#244861] text-slate-100"
                            : "border-transparent bg-[#274760] text-slate-100"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={async () => {
                            const conversationId = activeConversationIdRef.current;
                            if (!conversationId) return;

                            const ok = await setPdfAsActive(conversationId, pdf.id);
                            if (!ok) return;

                            setActivePdfId(pdf.id);

                            const uiStatus = classifyPdfUiStatus(pdf);
                            setShowPdfHint(
                              uiStatus === "no_text" ||
                                uiStatus === "technical_error" ||
                                uiStatus === "large"
                            );

                            await loadConversationPdfs(conversationId);
                          }}
                          className="max-w-[96px] truncate font-medium"
                          title={pdf.fileName}
                        >
                          {truncatePdfName(pdf.fileName, 9)}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleSelectedPdf(pdf.id)}
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            isSelectedPdf
                              ? "bg-emerald-600 text-white"
                              : "border border-slate-300/60 bg-transparent text-transparent hover:border-slate-200"
                          }`}
                          title={
                            isSelectedPdf
                              ? "Remover da seleção do chat"
                              : "Selecionar para o chat"
                          }
                        >
                          {isSelectedPdf ? "✓" : "○"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemovePdf(pdf.id)}
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                          title="Excluir PDF"
                        >
                          ×
                        </button>

                        {itemBadge && (
                          <span className="rounded-full bg-black/20 px-2 py-[2px] text-[9px]">
                            {itemBadge}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {attachedPdfs.length > 0 && (
                <div ref={quickActionsRef} className="relative shrink-0">
                  <button
                    type="button"
                    disabled={!attachedPdf || isBlocked || accessLoading}
                    onClick={() =>
                      attachedPdf && setShowPdfQuickActions((prev) => !prev)
                    }
                    className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-[10px] font-semibold ${
                      attachedPdf && !isBlocked && !accessLoading
                        ? "bg-[#1b3a56] text-slate-100 hover:bg-[#223f57]"
                        : "cursor-not-allowed bg-[#1b3a56] text-slate-400 opacity-60"
                    }`}
                  >
                    AÇÕES RÁPIDAS COM O PDF ▾
                  </button>

                  {showPdfQuickActions && attachedPdf && (
                    <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-slate-600 bg-[#1f3b4f] py-2 text-xs text-slate-100 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPdfQuickActions(false);
                          handlePdfQuickAction("resumo");
                        }}
                        className="block w-full px-4 py-2 text-left hover:bg-[#223f57]"
                      >
                        Resumir PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPdfQuickActions(false);
                          handlePdfQuickAction("pontos");
                        }}
                        className="block w-full px-4 py-2 text-left hover:bg-[#223f57]"
                      >
                        Pontos de Atenção (Obrigações, prazos e riscos)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPdfQuickActions(false);
                          handlePdfQuickAction("irregularidade");
                        }}
                        className="block w-full px-4 py-2 text-left hover:bg-[#223f57]"
                      >
                        Identificar irregularidades
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isUploadingPdf && (
              <div className="mb-2 text-[11px] text-slate-100">Enviando PDF...</div>
            )}

            <ChatInput
              onSend={handleSend}
              isSending={isSending}
              onStop={handleStop}
              disabled={isBlocked || accessLoading}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-[#2f4f67]">
      <div className="flex h-full flex-col md:hidden">
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-[#f5f5f5] px-4 py-3 text-slate-900 shadow-sm">
          <div className="flex items-center gap-2">
            <a href="https://nexuspublica.com.br/" target="_blank" rel="noreferrer noopener">
              <Image
                src="https://nexuspublica.com.br/wp-content/uploads/2025/09/icon_nexus.png"
                alt="Logo Publ.IA - Nexus Pública"
                width={28}
                height={28}
                className="rounded"
              />
            </a>
            <div>
              <div className="text-sm font-semibold leading-none">Publ.IA 1.7 ESSENCIAL</div>
              <div className="text-[11px] text-slate-500 leading-none">Nexus Pública</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] text-slate-600">
              Usuário: <span className="font-semibold break-all">{userLabel}</span>
            </span>

            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white shadow-sm"
            >
              <span className="flex flex-col gap-[3px]">
                <span className="block h-[2px] w-4 rounded bg-slate-700" />
                <span className="block h-[2px] w-4 rounded bg-slate-700" />
                <span className="block h-[2px] w-4 rounded bg-slate-700" />
              </span>
            </button>
          </div>
        </header>

        <div className="relative flex flex-1 pt-[64px]">
          <div
            className={`fixed inset-y-0 left-0 z-40 w-72 max-w-full overflow-y-auto bg-[#f5f5f5] shadow-lg transform transition-transform duration-200 ${
              isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <ChatSidebar
              conversations={conversations}
              activeConversationId={activeConversationId}
              onNewConversation={() => handleNewConversation()}
              onSelectConversation={(id) => handleSelectConversation(id)}
              onDeleteConversation={(id) => handleDeleteConversation(id)}
              userLabel={userLabel}
              isBlocked={isBlocked}
              blockedMessage={blockedMessage}
              blockedCta={blockedCta}
              access={access}
              accessLoading={accessLoading}
            />
          </div>

          {isMobileSidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/40"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
          )}

          <main className="flex flex-1 flex-col bg-[#2f4f67]">{renderMain()}</main>
        </div>
      </div>

      <div className="hidden h-full flex-row md:flex">
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onNewConversation={() => handleNewConversation()}
          onSelectConversation={(id) => handleSelectConversation(id)}
          onDeleteConversation={(id) => handleDeleteConversation(id)}
          userLabel={userLabel}
          isBlocked={isBlocked}
          blockedMessage={blockedMessage}
          blockedCta={blockedCta}
          access={access}
          accessLoading={accessLoading}
        />

        <main className="flex flex-1 flex-col bg-[#2f4f67]">{renderMain()}</main>
      </div>
    </div>
  );
}