"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";
import { ChatMessagesList, type ChatMessage } from "@/app/chat/components/ChatMessagesList";
import CopyConversationButton from "./CopyConversationButton";

type Props = { shareId: string };

type ConversationRow = {
  id: string;
  title: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function SharedConversationClient({ shareId }: Props) {
  const supabase = useMemo(() => createBrowserClient(supabaseUrl, supabaseAnonKey), []);

  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setConv(null);
      setMessages([]);

      // 1) conversa por share_id
      const { data: c, error: e1 } = await supabase
        .from("conversations")
        .select("id, title, created_at")
        .eq("is_shared", true)
        .eq("share_id", shareId)
        .maybeSingle<ConversationRow>();

      if (cancelled) return;

      if (e1) {
        setError(e1.message);
        setLoading(false);
        return;
      }

      if (!c) {
        setConv(null);
        setLoading(false);
        return;
      }

      setConv(c);

      // 2) mensagens
      const { data: m, error: e2 } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (e2) {
        setError(e2.message);
        setLoading(false);
        return;
      }

      const mapped: ChatMessage[] = ((m ?? []) as MessageRow[]).map((x) => ({
        id: x.id,
        role: x.role,
        content: x.content,
        created_at: x.created_at,
      }));

      setMessages(mapped);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [shareId, supabase]);

  const formattedDate = conv
    ? new Date(conv.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "";

  const title =
    conv && (conv.title || "").trim() && conv.title!.trim().toLowerCase() !== "nova conversa"
      ? conv.title!.trim()
      : "Conversa compartilhada";

  // estados
  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white shadow p-6 text-center text-sm text-slate-700">
          <h1 className="text-base font-semibold mb-2">Configuração incompleta do servidor</h1>
          <p>Env do Supabase ausente no .env.local.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#2b4e69] text-slate-50 flex items-center justify-center px-4">
        Carregando…
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white shadow p-6 text-center text-sm text-slate-700">
          <h1 className="text-base font-semibold mb-2">Erro ao carregar conversa</h1>
          <p className="text-xs text-slate-500">Detalhe: {error}</p>
        </div>
      </main>
    );
  }

  if (!conv) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white shadow p-6 text-center text-sm text-slate-700">
          <h1 className="text-base font-semibold mb-2">Conversa não encontrada</h1>
          <p className="text-xs text-slate-500 break-all">
            ID do compartilhamento: <code>{shareId}</code>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#2b4e69] text-slate-50">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#2b4e69]/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 overflow-hidden rounded-lg bg-white/10 flex items-center justify-center">
              <Image
                src="https://nexuspublica.com.br/wp-content/uploads/2025/09/icon_nexus.png"
                alt="Nexus Pública"
                width={28}
                height={28}
                className="rounded"
              />
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight">{title}</div>
              <div className="text-[11px] text-slate-200/80 leading-tight">
                Publ.IA · {formattedDate}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CopyConversationButton targetId="share-conversation-content" />
            <a
              href="https://nexuspublica.com.br/"
              target="_blank"
              rel="noreferrer noopener"
              className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15"
            >
              Conheça NEXUS PÚBLICA
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {messages.length === 0 ? (
          <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-50 border border-white/10">
            Nenhuma mensagem encontrada nesta conversa.
          </div>
        ) : (
          <div id="share-conversation-content">
            {/* key força remount quando shareId muda */}
            <ChatMessagesList key={shareId} messages={messages} isSending={false} variant="share" />
          </div>
        )}

        <footer className="mt-10 border-t border-white/10 pt-4 text-center text-[11px] text-slate-200/70">
          Esta é uma visualização pública de uma conversa compartilhada.
        </footer>
      </div>
    </main>
  );
}
