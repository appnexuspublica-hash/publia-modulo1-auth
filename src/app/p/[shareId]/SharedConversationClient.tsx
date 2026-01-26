// src/app/p/[shareId]/SharedConversationClient.tsx
"use client";

import { useEffect, useState } from "react";
import { ChatMessagesList, ChatMessage } from "@/app/chat/components/ChatMessagesList";

type Props = { shareId: string };

export default function SharedConversationClient({ shareId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("Conversa compartilhada");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/public/share/${shareId}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = String(data?.error ?? "Falha ao carregar conversa.");
          throw new Error(msg);
        }

        const convTitle = String(data?.conversation?.title ?? "Conversa compartilhada");
        const msgs = Array.isArray(data?.messages) ? data.messages : [];

        if (!mounted) return;

        setTitle(convTitle);
        setMessages(
          msgs.map((m: any) => ({
            id: String(m.id),
            role: m.role === "user" ? "user" : "assistant",
            content: String(m.content ?? ""),
            created_at: m.created_at ? String(m.created_at) : undefined,
          }))
        );
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Erro inesperado.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [shareId]);

  return (
    <div className="min-h-screen bg-[#2f4f67]">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <div className="mb-4 rounded-2xl bg-black/15 px-5 py-4 text-slate-100">
          <div className="text-sm opacity-80">Compartilhamento público</div>
          <div className="text-lg font-semibold">{title}</div>
        </div>

        {loading ? (
          <div className="text-slate-100/90">Carregando...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-slate-100">
            Erro ao carregar conversa: {error}
          </div>
        ) : (
          <ChatMessagesList
            variant="share"
            messages={messages}
            isSending={false}
          />
        )}
      </div>
    </div>
  );
}
