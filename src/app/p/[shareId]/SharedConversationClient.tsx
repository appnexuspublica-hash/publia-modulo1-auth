// src/app/p/[shareId]/SharedConversationClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { copyMessageToClipboard } from "@/lib/copy/copyMessageToClipboard";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type ApiResponse = {
  conversation: { id: string; title: string | null; created_at: string };
  conversationId: string;
  messages: ChatMessage[];
  __debug?: any;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDateLabel(iso?: string | null) {
  const s = String(iso ?? "").trim();
  if (!s) return "";

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  const datePart = dateFormatter.format(d);

  const parts = timeFormatter.formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "";
  const timePart = hh && mm ? `${hh}:${mm}` : timeFormatter.format(d);

  return `${datePart} - ${timePart}h`;
}

function Icon({ children, className = "h-5 w-5" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function QuestionIcon() {
  return (
    <Icon>
      <path
        d="M9.1 9a3 3 0 1 1 5.8 1c-.45 1.2-1.9 1.7-2.55 2.52-.3.37-.35.68-.35 1.48m0 3h.01M12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

function SparklesIcon() {
  return (
    <Icon>
      <path
        d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Zm6 12 .9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15ZM6 15l.9 2.1L9 18l-2.1.9L6 21l-.9-2.1L3 18l2.1-.9L6 15Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

function CopyIcon() {
  return (
    <Icon className="h-4 w-4">
      <path
        d="M9 9h10v10H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

function LinkIcon() {
  return (
    <Icon className="h-4 w-4">
      <path
        d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L10.7 5.24M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L13.3 18.76"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

const markdownClassName = [
  "text-[17px] leading-8 text-slate-900",
  "[&_p]:mb-5 [&_p:last-child]:mb-0",
  "[&_strong]:font-semibold [&_strong]:text-slate-950",
  "[&_h1]:mb-4 [&_h1]:mt-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-950",
  "[&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-950",
  "[&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-slate-950",
  "[&_ul]:mb-5 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-2",
  "[&_ol]:mb-5 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-2",
  "[&_li]:pl-1",
  "[&_hr]:my-7 [&_hr]:border-slate-300",
  "[&_blockquote]:my-5 [&_blockquote]:rounded-2xl [&_blockquote]:border [&_blockquote]:border-slate-300 [&_blockquote]:bg-slate-100 [&_blockquote]:px-5 [&_blockquote]:py-4",
  "[&_table]:mb-5 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-2xl",
  "[&_thead]:bg-slate-100",
  "[&_th]:border [&_th]:border-slate-300 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_th]:text-slate-900",
  "[&_td]:border [&_td]:border-slate-300 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-sm",
  "[&_a]:font-semibold [&_a]:text-slate-950 [&_a]:underline [&_a]:decoration-slate-400",
  "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
  "[&_pre]:mb-5 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100",
].join(" ");

export default function SharedConversationClient({ shareId }: { shareId: string }) {
  const searchParams = useSearchParams();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<string | null>(null);

  const cleanShareId = useMemo(() => String(shareId ?? "").trim(), [shareId]);

  const messageIdFromQuery = useMemo(() => {
    const m = searchParams?.get("m");
    return String(m ?? "").trim();
  }, [searchParams]);

  const cleanMessageId = useMemo(() => {
    const v = String(messageIdFromQuery ?? "").trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : "";
  }, [messageIdFromQuery]);

  const selected = useMemo(() => {
    const msgs = data?.messages ?? [];
    if (!msgs.length) return { dateLabel: "", userMessage: null as ChatMessage | null, assistantMessage: null as ChatMessage | null };

    if (!messageIdFromQuery) {
      const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant") ?? null;
      const assistantIndex = lastAssistant ? msgs.findIndex((m) => m.id === lastAssistant.id) : -1;
      let userMsg: ChatMessage | null = null;

      if (assistantIndex >= 0) {
        for (let i = assistantIndex - 1; i >= 0; i--) {
          if (msgs[i].role === "user") {
            userMsg = msgs[i];
            break;
          }
        }
      }

      return {
        dateLabel: formatDateLabel(lastAssistant?.created_at),
        userMessage: userMsg,
        assistantMessage: lastAssistant,
      };
    }

    const idx = msgs.findIndex((m) => m.id === messageIdFromQuery);
    if (idx === -1) return { dateLabel: "", userMessage: null, assistantMessage: null };

    const target = msgs[idx];
    let userMsg: ChatMessage | null = null;
    let assistantMsg: ChatMessage | null = null;

    if (target.role === "assistant") {
      assistantMsg = target;
      for (let i = idx - 1; i >= 0; i--) {
        if (msgs[i].role === "user") {
          userMsg = msgs[i];
          break;
        }
      }
    } else {
      userMsg = target;
      for (let i = idx + 1; i < msgs.length; i++) {
        if (msgs[i].role === "assistant") {
          assistantMsg = msgs[i];
          break;
        }
      }
    }

    return {
      dateLabel: formatDateLabel(assistantMsg?.created_at),
      userMessage: userMsg,
      assistantMessage: assistantMsg,
    };
  }, [data, messageIdFromQuery]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const qs = cleanMessageId ? `?m=${encodeURIComponent(cleanMessageId)}` : "";
        const res = await fetch(`/api/public/share/${cleanShareId}${qs}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as any;

        if (!res.ok) {
          if (!cancelled) {
            setError(String(json?.error ?? "Falha ao carregar conversa pública."));
            setData(null);
          }
          return;
        }

        if (!cancelled) setData(json as ApiResponse);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erro ao carregar conversa pública.");
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (cleanShareId) load();
    else {
      setLoading(false);
      setError("shareId ausente.");
      setData(null);
    }

    return () => {
      cancelled = true;
    };
  }, [cleanShareId, cleanMessageId]);

  function showTemporaryToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function handleCopyDisplayed() {
    if (!selected.assistantMessage?.id) return;
    try {
      await copyMessageToClipboard(selected.assistantMessage.id);
      showTemporaryToast("Conteúdo copiado.");
    } catch (e: any) {
      showTemporaryToast(e?.message ?? "Não foi possível copiar.");
    }
  }

  async function handleCopyCurrentLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showTemporaryToast("Link copiado.");
    } catch {
      showTemporaryToast("Não foi possível copiar o link.");
    }
  }

  const hasContent = Boolean(selected.userMessage || selected.assistantMessage);

  return (
    <div className="min-h-screen bg-[#e6e6e6] text-slate-950">
      <header className="border-b border-slate-300 bg-white/95 px-4 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/logos/nexus.png"
              alt="Publ.IA"
              className="h-12 w-auto object-contain sm:h-14"
            />

            <div className="h-12 w-px bg-slate-300" />

            <div className="text-xl font-extrabold leading-tight text-slate-900 sm:text-2xl">
              Conteúdo compartilhado via Publ.IA
            </div>
          </div>

          <a
            href="https://nexuspublica.com.br/"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center justify-center rounded-full border border-[#00657d] bg-[#00657d] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#00566a]"
          >
            Conheça a Nexus Pública
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {toast && (
          <div className="mb-4 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm">
            {toast}
          </div>
        )}

        {loading && (
          <div className="rounded-3xl border border-slate-300 bg-white px-6 py-5 text-base text-slate-800 shadow-sm">
            Carregando conversa compartilhada...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-red-300 bg-red-50 px-6 py-5 text-base text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {hasContent ? (
              <div className="space-y-5">
                {selected.userMessage && (
                  <article className="rounded-3xl border border-slate-300 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-4 flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-300">
                        <QuestionIcon />
                      </div>

                      <div>
                        <div className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-[13px] font-black uppercase tracking-[0.16em] text-slate-900 ring-1 ring-slate-300">
                          Pergunta
                        </div>
                        {selected.userMessage.created_at && (
                          <div className="mt-2 text-sm font-medium text-slate-500">
                            {formatDateLabel(selected.userMessage.created_at)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="whitespace-pre-wrap text-[18px] leading-8 text-slate-950">
                      {selected.userMessage.content}
                    </div>
                  </article>
                )}

                {selected.assistantMessage && (
                  <article className="rounded-3xl border border-slate-300 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-300">
                          <SparklesIcon />
                        </div>

                        <div>
                          <div className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-[13px] font-black uppercase tracking-[0.16em] text-slate-900 ring-1 ring-slate-300">
                            Resposta do Publ.IA
                          </div>
                          {selected.assistantMessage.created_at && (
                            <div className="mt-2 text-sm font-medium text-slate-500">
                              {formatDateLabel(selected.assistantMessage.created_at)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <button
                          type="button"
                          onClick={handleCopyDisplayed}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
                        >
                          <CopyIcon />
                          Copiar
                        </button>

                        <button
                          type="button"
                          onClick={handleCopyCurrentLink}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
                        >
                          <LinkIcon />
                          Compartilhar link
                        </button>
                      </div>
                    </div>

                    <div data-copy-id={selected.assistantMessage.id} className={markdownClassName}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selected.assistantMessage.content}
                      </ReactMarkdown>
                    </div>
                  </article>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-300 bg-white px-6 py-5 text-base text-slate-800 shadow-sm">
                Mensagem não encontrada para este link.
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-300 bg-white/95 px-4 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 text-sm font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Compartilhado por <span className="font-black text-slate-900">Publ.IA</span> — Nexus
            Pública
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://nexuspublica.com.br/app-publ-ia/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-slate-800 underline-offset-4 hover:underline"
            >
              Sobre
            </a>
            <span className="text-slate-400">|</span>
            <a
              href="https://nexuspublica.com.br/termo-de-uso/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-slate-800 underline-offset-4 hover:underline"
            >
              Termo de uso
            </a>
            <span className="text-slate-400">|</span>
            <a
              href="https://nexuspublica.com.br/contato/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-slate-800 underline-offset-4 hover:underline"
            >
              Fale conosco
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
