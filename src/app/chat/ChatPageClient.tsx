// src/app/chat/ChatPageClient.tsx
"use client";

import { copyMessageToClipboard } from "@/lib/copy/copyMessageToClipboard";
import { useEffect, useState, useRef, ChangeEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";

import { ChatSidebar } from "./components/ChatSidebar";
import { ChatEmptyState } from "./components/ChatEmptyState";
import { ChatInput } from "./components/ChatInput";
import { ChatMessage, ChatMessagesList } from "./components/ChatMessagesList";

type ChatPageClientProps = {
  userId: string;
  userLabel: string;
};

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MAX_PDF_SIZE_MB = 48;

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  is_shared?: boolean;
  share_id?: string | null;
};

type AttachedPdf = {
  id: string;
  fileName: string;
  fileSize: number;
};

type QuickActionKind = "resumo" | "pontos" | "irregularidade";

type SSEParsed =
  | { event: "meta"; data: any }
  | { event: "delta"; data: { text?: string } }
  | { event: "done"; data: any }
  | { event: "error"; data: { error?: string } }
  | { event: string; data: any };

function parseSSEBlock(block: string): SSEParsed | null {
  const lines = block.split("\n").map((l) => l.trimEnd());
  let eventName = "";
  let dataLine = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.replace("event:", "").trim();
    } else if (line.startsWith("data:")) {
      dataLine = line.replace("data:", "").trim();
    }
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

export default function ChatPageClient({ userId, userLabel }: ChatPageClientProps) {
  const [supabase] = useState(() => createBrowserClient(supabaseUrl, supabaseAnonKey));

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // ✅ Ref precisa ficar sincronizado IMEDIATAMENTE (não só via useEffect)
  const activeConversationIdRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [attachedPdf, setAttachedPdf] = useState<AttachedPdf | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showPdfQuickActions, setShowPdfQuickActions] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const justCreatedConversationRef = useRef(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const stoppedByUserRef = useRef(false);
  const streamingAssistantIdRef = useRef<string | null>(null);

  // ✅ Toast simples (sem alert) — mantém para erros/avisos gerais
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);

  // ✅ Toast por mensagem (fica acima dos botões Copiar/Compartilhar)
  const [actionToast, setActionToast] = useState<{ messageId: string; text: string } | null>(null);
  const actionToastTimerRef = useRef<any>(null);

  function showToast(msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }

  function showActionToast(messageId: string, text: string) {
    if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
    setActionToast({ messageId, text });
    actionToastTimerRef.current = setTimeout(() => setActionToast(null), 2500);
  }

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
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
        idx === -1 ? [...prev].reverse().findIndex((m) => m.role === "assistant") : -1;

      const realIdx = idx !== -1 ? idx : fallbackIdx === -1 ? -1 : prev.length - 1 - fallbackIdx;

      if (realIdx === -1) return prev;

      const m = prev[realIdx];
      if (m.role !== "assistant") return prev;

      const marker = "\n\n*(Resposta interrompida pelo usuário.)*";
      const already = (m.content || "").includes("Resposta interrompida pelo usuário");

      const next = [...prev];
      next[realIdx] = {
        ...m,
        content: already ? m.content : (m.content || "").trimEnd() + marker,
      };
      return next;
    });
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setAttachedPdf(null);
      setShowPdfQuickActions(false);
      setActionToast(null);
      return;
    }

    if (justCreatedConversationRef.current) {
      justCreatedConversationRef.current = false;
      return;
    }

    // ✅ FIX: evita “descasamento visual”
    setMessages([]);
    setLoadingMessages(true);
    setActionToast(null);

    async function loadMessages() {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", activeConversationId)
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

        setMessages(msgs);
      } finally {
        setLoadingMessages(false);
      }
    }

    loadMessages();
  }, [activeConversationId, supabase]);

  async function createConversation(shouldResetState: boolean = false): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          user_id: userId,
          title: "Nova conversa",
        })
        .select("id, title, created_at, is_shared, share_id")
        .single();

      if (error) {
        console.error("Erro ao criar conversa:", error.message);
        showToast("Não foi possível criar a conversa.");
        return null;
      }

      const newConv = data as Conversation;
      setConversations((prev) => [newConv, ...prev]);

      setActiveConversationId(newConv.id);
      activeConversationIdRef.current = newConv.id;

      justCreatedConversationRef.current = true;

      if (shouldResetState) {
        setMessages([]);
        setAttachedPdf(null);
        setShowPdfQuickActions(false);
        setActionToast(null);
      }

      return newConv.id;
    } catch (err) {
      console.error("Erro inesperado ao criar conversa:", err);
      showToast("Erro inesperado ao criar conversa.");
      return null;
    }
  }

  async function handleNewConversation() {
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

    setAttachedPdf(null);
    setShowPdfQuickActions(false);
    setIsMobileSidebarOpen(false);

    setActionToast(null);
  }

  async function handleDeleteConversation(id: string) {
    const confirmDelete = window.confirm("Tem certeza que deseja excluir esta conversa?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("conversations").delete().eq("id", id).eq("user_id", userId);

    if (error) {
      console.error("Erro ao excluir conversa:", error.message);
      showToast("Não foi possível excluir a conversa.");
      return;
    }

    setConversations((prev) => prev.filter((c) => c.id !== id));

    if (activeConversationId === id) {
      setActiveConversationId(null);
      activeConversationIdRef.current = null;

      setMessages([]);
      setAttachedPdf(null);
      setShowPdfQuickActions(false);
      setActionToast(null);
    }
  }

  async function ensureConversationId(): Promise<string | null> {
    if (activeConversationIdRef.current) return activeConversationIdRef.current;
    const created = await createConversation(false);
    return created;
  }

  async function handleSend(messageText: string) {
    const trimmed = messageText.trim();
    if (!trimmed) return;

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
        const newTitle = base.length > maxLen ? base.slice(0, maxLen).trimEnd() + "..." : base;

        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, title: newTitle } : c))
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
        }),
      });

      if (!res.ok || !res.body) {
        console.error("Erro ao chamar /api/chat:", await res.text());
        showToast("Erro ao enviar mensagem para a IA.");
        setMessages((prev) => prev.filter((m) => m.id !== tempUserId && m.id !== tempAssistantId));
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
                  m.id === tempAssistantId ? { ...m, content: (m.content || "") + deltaText } : m
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
              prev.map((m) => (m.id === tempAssistantId ? { ...m, content: `Erro: ${msg}` } : m))
            );

            showToast(msg);
          }
        }
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Erro inesperado ao enviar mensagem para IA:", error);
        showToast("Erro ao enviar mensagem para a IA.");
        setMessages((prev) => prev.filter((m) => m.id !== tempUserId && m.id !== tempAssistantId));
      }
    } finally {
      abortRef.current = null;
      setIsSending(false);
      streamingAssistantIdRef.current = null;
      stoppedByUserRef.current = false;
    }
  }

  async function handleRegenerateLast(lastUserMessage: string) {
    await handleSend(lastUserMessage);
  }

  async function handlePdfQuickAction(kind: QuickActionKind) {
    if (!attachedPdf) {
      showToast("Anexe um PDF antes de usar as ações rápidas.");
      return;
    }

    let prompt = "";

    switch (kind) {
      case "resumo":
        prompt = `
Com base exclusivamente no PDF anexado a esta conversa (${attachedPdf.fileName}). Faça um resumo objetivo e didático, em linguagem simples, destacando:

- Contexto geral do documento;
- Principais pontos normativos ou orientações;
- Impactos práticos para a administração pública municipal.

Organize a resposta em tópicos e parágrafos curtos.
`.trim();
        break;

      case "pontos":
        prompt = `
Considerando apenas o conteúdo do PDF anexado a esta conversa (${attachedPdf.fileName}),
liste os principais PONTOS DE ATENÇÃO, focando especialmente em:

- Obrigações principais;
- Prazos relevantes;
- Riscos para a administração pública municipal em caso de descumprimento.

Explique de forma clara, em linguagem acessível, e organize em tópicos.
`.trim();
        break;

      case "irregularidade":
        prompt = `
Com base no conteúdo do PDF anexado a esta conversa (${attachedPdf.fileName}),
identifique possíveis IRREGULARIDADES, inconsistências ou pontos de atenção jurídica,
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
      // ✅ agora aparece acima dos botões da mensagem
      showActionToast(messageId, "Resposta copiada.");
      return;
    } catch (err) {
      console.warn("[copy] Falhou HTML copy, tentando fallback texto...", err);
    }

    try {
      const msg = messages.find((m) => m.id === messageId && m.role === "assistant");
      if (!msg) throw new Error("Mensagem não encontrada para copiar.");

      const plainText = markdownToPlainText(msg.content);
      await navigator.clipboard.writeText(plainText);

      // ✅ agora aparece acima dos botões da mensagem
      showActionToast(messageId, "Resposta copiada.");
    } catch (err) {
      console.error("Erro ao copiar resposta:", err);
      showToast("Não foi possível copiar a resposta.");
    }
  }

  // ----------------------------------------------------
  // ✅ Compartilhar por MENSAGEM (COPIAR LINK PÚBLICO)
  // Recebe conversationId + messageId (UUIDs)
  // ----------------------------------------------------
  async function handleShareConversation(conversationId: string, messageId: string) {
    const targetConversationId = String(conversationId ?? "").trim();
    const targetMessageId = String(messageId ?? "").trim();

    if (!targetConversationId || !isUuid(targetConversationId)) {
      showToast("Conversa inválida para compartilhar.");
      return;
    }
    if (!targetMessageId || !isUuid(targetMessageId)) {
      showToast("Mensagem inválida para compartilhar.");
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
        showToast(String(data?.error ?? "Não foi possível gerar o link público."));
        return;
      }

      const shareId = String(data?.shareId ?? "").trim();
      if (!shareId) {
        showToast("Não foi possível gerar o link público.");
        return;
      }

      // ✅ link do recorte por mensagem
      const url = `${window.location.origin}/p/${shareId}?m=${encodeURIComponent(targetMessageId)}`;
      await navigator.clipboard.writeText(url);

      // ✅ agora aparece acima dos botões da mensagem
      showActionToast(messageId, "Link público copiado.");
    } catch (err) {
      console.error("Erro inesperado ao compartilhar:", err);
      showToast("Erro inesperado ao gerar link público.");
    }
  }

  function handlePdfButtonClick() {
    fileInputRef.current?.click();
  }

  async function handlePdfChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = MAX_PDF_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      showToast(`PDF grande (${sizeMb} MB). Limite atual: ${MAX_PDF_SIZE_MB} MB.`);
      e.target.value = "";
      return;
    }

    setIsUploadingPdf(true);

    try {
      const conversationId = await ensureConversationId();
      if (!conversationId) {
        showToast("Não foi possível criar uma conversa para vincular o PDF.");
        setIsUploadingPdf(false);
        return;
      }

      const safeName = file.name.normalize("NFKD").replace(/[^\w.-]+/g, "_");
      const storagePath = `${conversationId}/${Date.now()}-${safeName}`;

      const { data: storageData, error: storageError } = await (supabase as any)
        .storage.from("pdf-files")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/pdf",
        });

      if (storageError || !storageData) {
        console.error("[Chat] Erro ao enviar PDF para o Supabase Storage:", storageError);
        showToast("Não foi possível enviar o PDF. Tente novamente.");
        return;
      }

      const finalStoragePath = storageData.path ?? storagePath;

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
        console.error("Erro ao registrar PDF no banco:", await res.text());
        showToast("PDF enviado, mas falhou ao registrar no histórico.");
        return;
      }

      const data = (await res.json()) as { id: string; fileName: string; fileSize: number };
      setAttachedPdf({ id: data.id, fileName: data.fileName, fileSize: data.fileSize });
      showToast("PDF anexado.");
    } catch (error) {
      console.error("Erro inesperado ao enviar PDF:", error);
      showToast("Não foi possível enviar o PDF.");
    } finally {
      e.target.value = "";
      setIsUploadingPdf(false);
    }
  }

  function handleRemovePdf() {
    setAttachedPdf(null);
    setShowPdfQuickActions(false);
  }

  const renderMain = () => (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {messages.length > 0 ? (
          <ChatMessagesList
            messages={messages}
            onCopyAnswer={handleCopyAnswer}
            onShareConversation={handleShareConversation}
            onRegenerateLast={handleRegenerateLast}
            isSending={isSending}
            variant="chat"
            activeConversationId={activeConversationId}
            actionToast={actionToast}
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
          {/* ✅ Toast (sem alert) — mantém para erros/avisos gerais */}
          {toast && (
            <div className="mb-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-slate-100">
              {toast}
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePdfButtonClick}
              className="inline-flex items-center justify-center rounded-full bg-[#1b3a56] px-4 py-2 text-[11px] font-semibold text-slate-100 hover:bg-[#223f57]"
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

            {attachedPdf && (
              <div className="flex items-center gap-2 rounded-full bg-[#1b3a56] px-4 py-2 text-[11px] text-slate-100">
                <span className="max-w-[240px] truncate">{attachedPdf.fileName}</span>
                <span className="opacity-80">{Math.round(attachedPdf.fileSize / 1024)} KB</span>
                <button
                  type="button"
                  onClick={handleRemovePdf}
                  className="ml-1 text-slate-100 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                disabled={!attachedPdf}
                onClick={() => attachedPdf && setShowPdfQuickActions((prev) => !prev)}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-[11px] font-semibold ${
                  attachedPdf
                    ? "bg-[#1b3a56] text-slate-100 hover:bg-[#223f57]"
                    : "bg-[#1b3a56] text-slate-400 opacity-60 cursor-not-allowed"
                }`}
              >
                AÇÕES RÁPIDAS COM O PDF ▾
              </button>

              {showPdfQuickActions && attachedPdf && (
                <div className="absolute left-0 z-10 mt-2 w-80 rounded-xl border border-slate-600 bg-[#1f3b4f] py-2 text-xs text-slate-100 shadow-lg">
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

            {/* ✅ Compartilhar foi removido daqui: agora fica junto do "Copiar" nas mensagens */}
          </div>

          {isUploadingPdf && <div className="mb-2 text-[11px] text-slate-100">Enviando PDF...</div>}

          <ChatInput onSend={handleSend} isSending={isSending} onStop={handleStop} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-[#2f4f67]">
      {/* MOBILE */}
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
              <div className="text-sm font-semibold leading-none">Publ.IA 1.7</div>
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
              onNewConversation={handleNewConversation}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
              userLabel={userLabel}
            />
          </div>

          {isMobileSidebarOpen && (
            <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setIsMobileSidebarOpen(false)} />
          )}

          <main className="flex flex-1 flex-col bg-[#2f4f67]">{renderMain()}</main>
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden h-full flex-row md:flex">
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          userLabel={userLabel}
        />

        <main className="flex flex-1 flex-col bg-[#2f4f67]">{renderMain()}</main>
      </div>
    </div>
  );
}
