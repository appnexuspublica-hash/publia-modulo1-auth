// src/app/p/[shareId]/SharedConversationClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChatMessagesList, ChatMessage } from "@/app/chat/components/ChatMessagesList";
import { copyMessageToClipboard } from "@/lib/copy/copyMessageToClipboard";

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

  // Seleciona apenas a mensagem alvo (assistant) e o user anterior (como "título")
  const selected = useMemo(() => {
    const msgs = data?.messages ?? [];
    if (!msgs.length) return { dateLabel: "", sliced: [] as ChatMessage[], assistantId: "" };

    if (!messageIdFromQuery) {
      // Sem ?m=, mostra tudo (fallback)
      const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
      const dateLabel = formatDateLabel(lastAssistant?.created_at);
      return {
        dateLabel,
        sliced: msgs.map((m) => ({ ...m, created_at: undefined })),
        assistantId: lastAssistant?.id ?? "",
      };
    }

    const idx = msgs.findIndex((m) => m.id === messageIdFromQuery);
    if (idx === -1) return { dateLabel: "", sliced: [] as ChatMessage[], assistantId: "" };

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

    if (!assistantMsg) return { dateLabel: "", sliced: [] as ChatMessage[], assistantId: "" };

    const dateLabel = formatDateLabel(assistantMsg.created_at);

    const sliced = [userMsg, assistantMsg].filter(Boolean) as ChatMessage[];

    // remove created_at para não aparecer divisor de data dentro da lista
    return {
      dateLabel,
      sliced: sliced.map((m) => ({ ...m, created_at: undefined })),
      assistantId: assistantMsg.id,
    };
  }, [data, messageIdFromQuery]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/public/share/${cleanShareId}`, { cache: "no-store" });
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
  }, [cleanShareId]);

  async function handleCopyDisplayed() {
    if (!selected.assistantId) return;
    try {
      await copyMessageToClipboard(selected.assistantId);
      setToast("Copiado.");
      setTimeout(() => setToast(null), 2200);
    } catch (e: any) {
      setToast(e?.message ?? "Não foi possível copiar.");
      setTimeout(() => setToast(null), 2200);
    }
  }

  const hasSlice = selected.sliced && selected.sliced.length > 0;

  return (
    <div className="min-h-screen bg-[#2f4f67]">
      {/* Barra de ações no topo */}
      <header className="border-b border-white/10 bg-[#1b3a56] px-4 py-3">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">Publ.IA — Compartilhamento</div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyDisplayed}
              disabled={!hasSlice}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                hasSlice
                  ? "border-white/60 text-white hover:bg-white/10"
                  : "border-white/20 text-white/40 cursor-not-allowed"
              }`}
            >
              Copiar
            </button>

            <a
              href="https://nexuspublica.com.br/"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/10"
            >
              Conheça a Nexus Pública
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        {toast && (
          <div className="mb-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-slate-100">
            {toast}
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white">
            Carregando...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Data da mensagem (sem balão) */}
            <div className="mb-4 text-[12px] text-white/80">
              Data da mensagem:{" "}
              <span className="font-semibold text-white">{selected.dateLabel || "—"}</span>
            </div>

            {/* Conteúdo */}
            {hasSlice ? (
              <ChatMessagesList messages={selected.sliced} isSending={false} variant="share" />
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/90">
                Mensagem não encontrada para este link.
              </div>
            )}

            {/* Mini rodapé */}
            <div className="mt-5 border-t border-white/10 pt-3 text-center text-[11px] text-white/70">
              Gerado por <span className="font-semibold text-white/80">Publ.IA</span> — Nexus Pública
            </div>
          </>
        )}
      </main>
    </div>
  );
}
