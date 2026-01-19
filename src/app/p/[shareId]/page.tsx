// src/app/p/[shareId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";

import { ChatMessagesList, type ChatMessage } from "@/app/chat/components/ChatMessagesList";
import CopyConversationButton from "./CopyConversationButton";

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

type ShareRow = {
  conversation_id: string;
};

export default function SharedConversationPage() {
  // ✅ Pega diretamente do Next
  const params = useParams() as { shareId?: string };
  const shareId = params?.shareId ?? "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // ✅ supabase só uma vez
  const supabase = useMemo(() => {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseUrl, supabaseAnonKey]);

  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(currentShareId: string) {
      setLoading(true);
      setErrorMsg(null);
      setConv(null);
      setMessages([]);

      try {
        console.log("=== SHARE PAGE DEBUG ===");
        console.log("shareId da URL:", currentShareId);

        if (!currentShareId || currentShareId.length < 10) {
          setErrorMsg("shareId inválido.");
          return;
        }

        // 1) ✅ Buscar conversation_id pelo shareId (tabela conversation_shares)
        const { data: shareRow, error: shareErr } = await supabase
          .from("conversation_shares")
          .select("conversation_id")
          .eq("share_id", currentShareId)
          .maybeSingle<ShareRow>();

        console.log("shareRow:", shareRow);
        console.log("erro share:", shareErr);

        if (shareErr) {
          setErrorMsg(shareErr.message || "Erro ao carregar link de compartilhamento.");
          return;
        }

        if (!shareRow?.conversation_id) {
          // link não existe
          setConv(null);
          return;
        }

        // 2) ✅ Buscar conversa por ID (conversations.id)
        const { data: convData, error: convError } = await supabase
          .from("conversations")
          .select("id, title, created_at")
          .eq("id", shareRow.conversation_id)
          .maybeSingle<ConversationRow>();

        console.log("conversa encontrada:", convData);
        console.log("erro conv:", convError);

        if (convError) {
          setErrorMsg(convError.message || "Erro ao carregar conversa.");
          return;
        }

        if (!convData) {
          setConv(null);
          return;
        }

        if (cancelled) return;
        setConv(convData);

        // 3) ✅ Buscar mensagens da conversa
        const { data: msgs, error: msgsError } = await supabase
          .from("messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", convData.id)
          .order("created_at", { ascending: true });

        console.log("mensagens qtd:", (msgs ?? []).length);
        console.log("erro msgs:", msgsError);

        if (msgsError) {
          setErrorMsg(msgsError.message || "Erro ao carregar mensagens.");
          return;
        }

        const mapped: ChatMessage[] = ((msgs ?? []) as MessageRow[]).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        }));

        if (cancelled) return;
        setMessages(mapped);
      } catch (e: any) {
        setErrorMsg(e?.message || "Erro inesperado.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load(shareId);

    return () => {
      cancelled = true;
    };
  }, [shareId, supabase]);

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white shadow p-6 text-center text-sm text-slate-700">
          <h1 className="text-base font-semibold mb-2">Configuração incompleta</h1>
          <p>
            As variáveis <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> não estão configuradas corretamente.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
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
                <div className="truncate text-sm font-semibold leading-tight">Carregando…</div>
                <div className="text-[11px] text-slate-200/80 leading-tight">Publ.IA</div>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-50 border border-white/10">
            Carregando conversa…
          </div>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white shadow p-6 text-center text-sm text-slate-700">
          <h1 className="text-base font-semibold mb-2">Erro ao carregar conversa</h1>
          <p className="mb-2">Ocorreu um erro ao tentar carregar esta conversa pública.</p>
          <p className="text-xs text-slate-500 break-all">Detalhe técnico: {errorMsg}</p>
          <p className="mt-3 text-xs text-slate-500 break-all">
            shareId: <code>{shareId}</code>
          </p>
        </div>
      </main>
    );
  }

  if (!conv) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white shadow p-6 text-center text-sm text-slate-700">
          <h1 className="text-base font-semibold mb-2">Conversa não encontrada</h1>
          <p className="mb-2">Não foi encontrada nenhuma conversa compartilhada para este link.</p>
          <p className="text-xs text-slate-500 break-all">
            ID do compartilhamento: <code>{shareId}</code>
          </p>
        </div>
      </main>
    );
  }

  const createdAt = new Date(conv.created_at);
  const formattedDate = createdAt.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const title =
    (conv.title || "").trim() && conv.title!.trim().toLowerCase() !== "nova conversa"
      ? conv.title!.trim()
      : "Conversa compartilhada";

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
            <ChatMessagesList messages={messages} isSending={false} variant="share" />
          </div>
        )}

        <footer className="mt-10 border-t border-white/10 pt-4 text-center text-[11px] text-slate-200/70">
          Esta é uma visualização pública de uma conversa compartilhada.
        </footer>
      </div>
    </main>
  );
}
