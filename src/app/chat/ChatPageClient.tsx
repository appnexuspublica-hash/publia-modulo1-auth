// src/app/chat/ChatPageClient.tsx
"use client";

import {
  useEffect,
  useState,
  useRef,
  ChangeEvent,
} from "react";
import { createBrowserClient } from "@supabase/ssr";

import { ChatSidebar } from "./components/ChatSidebar";
import { ChatEmptyState } from "./components/ChatEmptyState";
import { ChatInput } from "./components/ChatInput";
import {
  ChatMessage,
  ChatMessagesList,
} from "./components/ChatMessagesList";

// ------------------------------------------------------
// Tipos de props
// ------------------------------------------------------
type ChatPageClientProps = {
  userId: string;
  userLabel: string; // CPF/CNPJ (ou placeholder)
};

// ------------------------------------------------------
// Helper: converter markdown em texto simples (para copiar)
// ------------------------------------------------------
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

// ------------------------------------------------------
// Config Supabase (valores vêm do .env)
// ------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Limite de tamanho do PDF (em MB) – ajuste se quiser
const MAX_PDF_SIZE_MB = 48;

// ------------------------------------------------------
// Tipos
// ------------------------------------------------------
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

export default function ChatPageClient({
  userId,
  userLabel,
}: ChatPageClientProps) {
  // Criamos o client de browser uma única vez por montagem
  const [supabase] = useState(() =>
    createBrowserClient(supabaseUrl, supabaseAnonKey)
  );

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] =
    useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [attachedPdf, setAttachedPdf] = useState<AttachedPdf | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showPdfQuickActions, setShowPdfQuickActions] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Flag: conversa acabou de ser criada pelo front
  const justCreatedConversationRef = useRef(false);

  // ----------------------------------------------------
  // Carregar conversas ao abrir a página
  // ----------------------------------------------------
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

        if (convs.length > 0 && !activeConversationId) {
          setActiveConversationId(convs[0].id);
        }
      } finally {
        setLoadingConversations(false);
      }
    }

    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  // ----------------------------------------------------
  // Carregar mensagens quando muda a conversa ativa
  // ----------------------------------------------------
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setAttachedPdf(null);
      setShowPdfQuickActions(false);
      return;
    }

    // Se a conversa acabou de ser criada no cliente (primeira pergunta),
    // pulamos o carregamento para não apagar a bolha temporária.
    if (justCreatedConversationRef.current) {
      justCreatedConversationRef.current = false;
      return;
    }

    async function loadMessages() {
      setLoadingMessages(true);
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
          (data ?? []).map((m) => ({
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

  // ----------------------------------------------------
  // Conversas
  // ----------------------------------------------------
  async function createConversation(
    shouldResetState: boolean = false
  ): Promise<string | null> {
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
        alert("Não foi possível criar a conversa.");
        return null;
      }

      const newConv = data as Conversation;
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);

      // Marca que essa conversa acabou de ser criada no cliente
      justCreatedConversationRef.current = true;

      // Só limpamos mensagens/PDF quando for clique manual em "NOVA CONVERSA"
      if (shouldResetState) {
        setMessages([]);
        setAttachedPdf(null);
        setShowPdfQuickActions(false);
      }

      return newConv.id;
    } catch (err) {
      console.error("Erro inesperado ao criar conversa:", err);
      alert("Erro inesperado ao criar conversa.");
      return null;
    }
  }

  async function handleNewConversation() {
    // Clique manual no botão → queremos resetar a tela
    await createConversation(true);
  }

  function handleSelectConversation(id: string) {
    setActiveConversationId(id);
    setAttachedPdf(null);
    setShowPdfQuickActions(false);
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
      alert("Não foi possível excluir a conversa.");
      return;
    }

    setConversations((prev) => prev.filter((c) => c.id !== id));

    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
      setAttachedPdf(null);
      setShowPdfQuickActions(false);
    }
  }

  async function ensureConversationId(): Promise<string | null> {
    if (activeConversationId) return activeConversationId;
    // Primeira mensagem: cria conversa, mas NÃO limpa o que já está na tela
    return await createConversation(false);
  }

  // ----------------------------------------------------
  // Enviar mensagem para IA
  // ----------------------------------------------------
  async function handleSend(messageText: string) {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    const conversationId = await ensureConversationId();
    if (!conversationId) return;

    const tempId = `temp-${Date.now()}`;

    const tempUserMessage: ChatMessage = {
      id: tempId,
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, tempUserMessage]);
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          message: trimmed,
        }),
      });

      if (!res.ok) {
        console.error("Erro ao chamar /api/chat:", await res.text());
        alert("Erro ao enviar mensagem para a IA.");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }

      const data = (await res.json()) as {
        userMessage: {
          id: string;
          role: string;
          content: string;
          created_at: string;
        };
        assistantMessage: {
          id: string;
          role: string;
          content: string;
          created_at: string;
        };
      };

      const conversationIdForTitle = conversationId;

      const userMsg: ChatMessage = {
        id: data.userMessage.id,
        role: data.userMessage.role as "user",
        content: data.userMessage.content,
        created_at: data.userMessage.created_at,
      };

      const assistantMsg: ChatMessage = {
        id: data.assistantMessage.id,
        role: data.assistantMessage.role as "assistant",
        content: data.assistantMessage.content,
        created_at: data.assistantMessage.created_at,
      };

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        userMsg,
        assistantMsg,
      ]);

      const existingConv = conversations.find(
        (c) => c.id === conversationIdForTitle
      );

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
            c.id === conversationIdForTitle ? { ...c, title: newTitle } : c
          )
        );

        try {
          await supabase
            .from("conversations")
            .update({ title: newTitle })
            .eq("id", conversationIdForTitle)
            .eq("user_id", userId);
        } catch (err) {
          console.error("Erro ao atualizar título da conversa:", err);
        }
      }
    } catch (error) {
      console.error("Erro inesperado ao enviar mensagem para IA:", error);
      alert("Erro ao enviar mensagem para a IA.");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  }

  // ----------------------------------------------------
  // Ações rápidas com o PDF
  // ----------------------------------------------------
  async function handlePdfQuickAction(kind: QuickActionKind) {
    if (!attachedPdf) {
      alert("Anexe um PDF antes de usar as ações rápidas.");
      return;
    }

    let prompt = "";

    switch (kind) {
      case "resumo":
        prompt = `
Com base exclusivamente no PDF anexado a esta conversa (${attachedPdf.fileName}),
faça um resumo objetivo e didático, em linguagem simples, destacando:

- contexto geral do documento;
- principais pontos normativos ou orientações;
- impactos práticos para a administração pública municipal.

Organize a resposta em tópicos e parágrafos curtos.
`.trim();
        break;

      case "pontos":
        prompt = `
Considerando apenas o conteúdo do PDF anexado a esta conversa (${attachedPdf.fileName}),
liste os principais PONTOS DE ATENÇÃO, focando especialmente em:

- obrigações principais;
- prazos relevantes;
- riscos para a administração pública municipal em caso de descumprimento.

Explique de forma clara, em linguagem acessível, e organize em tópicos.
`.trim();
        break;

      case "irregularidade":
        prompt = `
Com base no conteúdo do PDF anexado a esta conversa (${attachedPdf.fileName}),
identifique possíveis IRREGULARIDADES, inconsistências ou pontos de atenção jurídica,
tanto formais quanto materiais, que possam gerar risco para a administração pública municipal.

Aponte:
- dispositivos que possam gerar dúvidas ou conflitos com a legislação vigente;
- riscos de responsabilização do gestor;
- recomendações de cautela.

Organize a resposta em tópicos, com explicações objetivas.
`.trim();
        break;
    }

    await handleSend(prompt);
  }

  // ----------------------------------------------------
  // Copiar resposta (limpando markdown)
  // ----------------------------------------------------
  async function handleCopyAnswer(messageId: string) {
    const msg = messages.find(
      (m) => m.id === messageId && m.role === "assistant"
    );
    if (!msg) return;

    try {
      const plainText = markdownToPlainText(msg.content);
      await navigator.clipboard.writeText(plainText);
    } catch (err) {
      console.error("Erro ao copiar resposta:", err);
      alert("Não foi possível copiar a resposta.");
    }
  }

  // ----------------------------------------------------
  // Compartilhar conversa
  // ----------------------------------------------------
  async function handleShareConversation() {
    if (!activeConversationId) {
      alert("Nenhuma conversa selecionada.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, is_shared, share_id")
        .eq("id", activeConversationId)
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error(
          "Erro ao carregar conversa para compartilhar:",
          error.message
        );
        alert("Não foi possível preparar o compartilhamento.");
        return;
      }

      let shareId = data.share_id as string | null;

      if (!shareId) {
        shareId = crypto.randomUUID();
      }

      const { error: updateError } = await supabase
        .from("conversations")
        .update({
          is_shared: true,
          share_id: shareId,
        })
        .eq("id", activeConversationId)
        .eq("user_id", userId);

      if (updateError) {
        console.error(
          "Erro ao marcar conversa como compartilhada:",
          updateError.message
        );
        alert("Não foi possível compartilhar a conversa.");
        return;
      }

      const url = `${window.location.origin}/p/${shareId}`;

      try {
        await navigator.clipboard.writeText(url);
        alert(
          "Link público da conversa copiado para a área de transferência:\n\n" +
            url
        );
      } catch (copyError) {
        console.error("Erro ao copiar link público:", copyError);
        window.prompt(
          "Link público da conversa (copie manualmente):",
          url
        );
      }
    } catch (error) {
      console.error("Erro inesperado ao compartilhar conversa:", error);
      alert("Erro inesperado ao compartilhar a conversa.");
    }
  }

  // ----------------------------------------------------
  // Upload de PDF (direto no Supabase Storage)
  // ----------------------------------------------------
  function handlePdfButtonClick() {
    fileInputRef.current?.click();
  }

  async function handlePdfChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Checagem de tamanho antes de qualquer coisa
    const maxBytes = MAX_PDF_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      alert(
        `Este PDF tem ${sizeMb} MB e o limite atual é de ${MAX_PDF_SIZE_MB} MB.\n\n` +
          "Tente dividir o arquivo em partes menores (por exemplo, um PDF por anexo ou por capítulo) " +
          "e envie novamente."
      );
      e.target.value = "";
      return;
    }

    setIsUploadingPdf(true);

    try {
      // Garante que existe uma conversa antes de subir o PDF
      const conversationId = await ensureConversationId();
      if (!conversationId) {
        alert("Não foi possível criar uma conversa para vincular o PDF.");
        setIsUploadingPdf(false);
        return;
      }

      // 1) Upload direto pro Supabase Storage (não passa pela Vercel)
      const safeName = file.name
        .normalize("NFKD")
        .replace(/[^\w.-]+/g, "_");

      const storagePath = `${conversationId}/${Date.now()}-${safeName}`;

      const { data: storageData, error: storageError } = await (supabase as any)
        .storage
        .from("pdf-files")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/pdf",
        });

      if (storageError || !storageData) {
        console.error(
          "[Chat] Erro ao enviar PDF para o Supabase Storage:",
          storageError
        );
        alert(
          "Não foi possível enviar o PDF para o servidor. Tente novamente em alguns instantes."
        );
        return;
      }

      const finalStoragePath = storageData.path ?? storagePath;

      // 2) Chama a API /api/upload-pdf só para registrar no banco (payload pequeno)
      const res = await fetch("/api/upload-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          fileName: file.name,
          fileSize: file.size,
          storagePath: finalStoragePath,
        }),
      });

      if (!res.ok) {
        console.error(
          "Erro ao registrar PDF no banco:",
          await res.text()
        );
        alert(
          "O arquivo foi enviado, mas não foi possível registrar o PDF no histórico da conversa."
        );
        return;
      }

      const data = (await res.json()) as {
        id: string;
        fileName: string;
        fileSize: number;
      };

      setAttachedPdf({
        id: data.id,
        fileName: data.fileName,
        fileSize: data.fileSize,
      });
    } catch (error) {
      console.error("Erro inesperado ao enviar PDF:", error);
      alert("Não foi possível enviar o PDF.");
    } finally {
      e.target.value = "";
      setIsUploadingPdf(false);
    }
  }

  function handleRemovePdf() {
    setAttachedPdf(null);
    setShowPdfQuickActions(false);
  }

  // ----------------------------------------------------
  // Render (Sidebar + Área principal)
  // ----------------------------------------------------
  return (
    <div className="flex h-screen flex-col bg-[#2f4f67] md:flex-row">
      <ChatSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        userLabel={userLabel}
      />

      <main className="flex flex-1 flex-col bg-[#2f4f67]">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {messages.length > 0 ? (
              <ChatMessagesList
                messages={messages}
                onCopyAnswer={handleCopyAnswer}
                onShareConversation={handleShareConversation}
                isSending={isSending}
                activePdfName={attachedPdf?.fileName ?? null}
              />
            ) : loadingMessages && activeConversationId ? (
              <div className="flex h-full items-center justify-center text-sm text-white">
                Processando resposta...
              </div>
            ) : isSending ? (
              <div className="flex h-full items-center justify-center text-sm text-white">
                Processando resposta...
              </div>
            ) : (
              <ChatEmptyState />
            )}
          </div>

          <div className="border-t border-slate-700 bg-[#2f4f67] px-6 py-3">
            <div className="mx-auto w-full max-w-3xl">
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
                    <span className="max-w-[240px] truncate">
                      {attachedPdf.fileName}
                    </span>
                    <span className="opacity-80">
                      {Math.round(attachedPdf.fileSize / 1024)} KB
                    </span>
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
                    onClick={() =>
                      attachedPdf &&
                      setShowPdfQuickActions((prev) => !prev)
                    }
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
                        Pontos de Atenção (obrigações, prazos e riscos)
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
              </div>

              {isUploadingPdf && (
                <div className="mb-2 text-[11px] text-slate-100">
                  Enviando PDF...
                </div>
              )}

              <ChatInput onSend={handleSend} disabled={isSending} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
