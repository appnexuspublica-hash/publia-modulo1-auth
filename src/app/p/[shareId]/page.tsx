// src/app/p/[shareId]/page.tsx
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import {
  ChatMessagesList,
  type ChatMessage,
} from "@/app/chat/components/ChatMessagesList";
import CopyConversationButton from "./CopyConversationButton";

type PageProps = {
  params: {
    shareId: string;
  };
};

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

export default async function SharedConversationPage({ params }: PageProps) {
  const { shareId } = params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ⚠️ Não quebra o build se as envs não existirem
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[share page] Supabase envs ausentes", {
      hasUrl: !!supabaseUrl,
      hasAnon: !!supabaseAnonKey,
    });

    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white shadow p-6 text-center text-sm text-slate-700">
          <h1 className="text-base font-semibold mb-2">
            Configuração incompleta do servidor
          </h1>
          <p>
            As variáveis <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> não estão configuradas
            corretamente no deploy.
          </p>
        </div>
      </main>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Buscar conversa compartilhada
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .select("id, title, created_at")
    .eq("is_shared", true)
    .eq("share_id", shareId)
    .maybeSingle<ConversationRow>();

  if (convError) {
    console.error(
      "[share page] Erro ao carregar conversa compartilhada:",
      convError.message
    );

    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white shadow p-6 text-center text-sm text-slate-700">
          <h1 className="text-base font-semibold mb-2">
            Erro ao carregar conversa compartilhada
          </h1>
          <p className="mb-2">
            Ocorreu um erro ao tentar carregar esta conversa pública.
          </p>
          <p className="text-xs text-slate-500">
            Detalhe técnico: {convError.message}
          </p>
        </div>
      </main>
    );
  }

  if (!conv) {
    console.warn(
      "[share page] Nenhuma conversa encontrada para este shareId:",
      shareId
    );

    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white shadow p-6 text-center text-sm text-slate-700">
          <h1 className="text-base font-semibold mb-2">Conversa não encontrada</h1>
          <p className="mb-2">
            Não foi encontrada nenhuma conversa compartilhada para este link.
          </p>
          <p className="text-xs text-slate-500 break-all">
            ID do compartilhamento: <code>{shareId}</code>
          </p>
        </div>
      </main>
    );
  }

  // 2) Buscar mensagens da conversa
  const { data: msgs, error: msgsError } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true });

  if (msgsError) {
    console.error("[share page] Erro ao carregar mensagens:", msgsError.message);

    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white shadow p-6 text-center text-sm text-slate-700">
          <h1 className="text-base font-semibold mb-2">Erro ao carregar mensagens</h1>
          <p className="mb-2">As mensagens desta conversa não puderam ser carregadas.</p>
          <p className="text-xs text-slate-500">Detalhe técnico: {msgsError.message}</p>
        </div>
      </main>
    );
  }

  const messages: ChatMessage[] = ((msgs ?? []) as MessageRow[]).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    created_at: m.created_at,
  }));

  // Formatar data/hora da conversa
  const createdAt = new Date(conv.created_at);
  const formattedDate = createdAt.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const title =
    (conv.title || "").trim() &&
    conv.title!.trim().toLowerCase() !== "nova conversa"
      ? conv.title!.trim()
      : "Conversa compartilhada";

  return (
    <main className="min-h-screen bg-[#2b4e69] text-slate-50">
      {/* Topbar */}
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
              <div className="truncate text-sm font-semibold leading-tight">
                {title}
              </div>
              <div className="text-[11px] text-slate-200/80 leading-tight">
                Publ.IA · {formattedDate}
              </div>
            </div>
          </div>

          {/* Ações */}
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

      {/* Conteúdo */}
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

        {/* Rodapé */}
        <footer className="mt-10 border-t border-white/10 pt-4 text-center text-[11px] text-slate-200/70">
          Esta é uma visualização pública de uma conversa compartilhada.
        </footer>
      </div>
    </main>
  );
}
