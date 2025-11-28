// src/app/p/[shareId]/page.tsx

import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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
            corretamente no ambiente de deploy.
          </p>
        </div>
      </main>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1) Buscar conversa compartilhada
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .select("id, title, created_at")
    .eq("is_shared", true)
    .eq("share_id", shareId)
    .maybeSingle<ConversationRow>();

  if (convError) {
    console.error("[share page] Erro ao carregar conversa compartilhada:", convError.message);
    // Evita derrubar o build; trata como 404
    return notFound();
  }

  if (!conv) {
    return notFound();
  }

  // 2) Buscar mensagens da conversa
  const { data: msgs, error: msgsError } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true });

  if (msgsError) {
    console.error("[share page] Erro ao carregar mensagens:", msgsError.message);
    return notFound();
  }

  const messages = (msgs ?? []) as MessageRow[];

  return (
    <main className="min-h-screen bg-[#2f4f67] text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* Cabeçalho simples */}
        <header className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl font-semibold">
            Conversa compartilhada - Publ.IA
          </h1>
          <p className="text-xs text-slate-200/80">
            Esta é uma visualização pública de uma conversa gerada pelo assistente Publ.IA.
          </p>
        </header>

        {/* Título da conversa */}
        <section className="mb-4 rounded-2xl bg-[#1f3b4f] px-4 py-3 shadow">
          <div className="text-[11px] uppercase tracking-wide text-slate-300">
            Título da conversa
          </div>
          <div className="mt-1 text-sm font-medium">
            {conv.title || "Conversa sem título"}
          </div>
        </section>

        {/* Mensagens */}
        <section className="space-y-3">
          {messages.length === 0 && (
            <div className="rounded-2xl bg-[#1f3b4f] px-4 py-3 text-sm text-slate-200">
              Nenhuma mensagem encontrada nesta conversa.
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex ${
                  isUser ? "justify-start" : "justify-start"
                }`}
              >
                <div
                  className={
                    "max-w-[90%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow " +
                    (isUser
                      ? "bg-[#f5f5f5] text-slate-900"
                      : "bg-[#224761] text-slate-50 border border-slate-600/40")
                  }
                >
                  {/* Rótulo (Usuário / Publ.IA) */}
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {isUser ? "Usuário" : "Publ.IA"}
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
