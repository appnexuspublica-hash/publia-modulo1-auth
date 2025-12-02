// src/app/p/[shareId]/page.tsx

import { createClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
          <h1 className="text-base font-semibold mb-2">
            Conversa não encontrada
          </h1>
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
    console.error(
      "[share page] Erro ao carregar mensagens:",
      msgsError.message
    );

    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white shadow p-6 text-center text-sm text-slate-700">
          <h1 className="text-base font-semibold mb-2">
            Erro ao carregar mensagens
          </h1>
          <p className="mb-2">
            As mensagens desta conversa não puderam ser carregadas.
          </p>
          <p className="text-xs text-slate-500">
            Detalhe técnico: {msgsError.message}
          </p>
        </div>
      </main>
    );
  }

  const messages = (msgs ?? []) as MessageRow[];

  // Formatar data/hora da conversa
  const createdAt = new Date(conv.created_at);
  const formattedDate = createdAt.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    // 🔹 Fundo da página ajustado para #2b4e69
    <main className="min-h-screen bg-[#2b4e69] text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Cabeçalho */}
        <header className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Conversa compartilhada · Publ.IA
          </h1>
          <p className="text-xs text-slate-200/80">
            Visualização pública das mensagens trocadas com o assistente
            Publ.IA.
          </p>
          <p className="text-[11px] text-slate-200 mt-1">
            Criada em <span className="font-medium">{formattedDate}</span>
          </p>
        </header>

        {/* Mensagens */}
        <section className="space-y-3">
          {messages.length === 0 && (
            <div className="rounded-2xl bg-[#154361] px-4 py-3 text-sm text-slate-50 border border-slate-700/40">
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
                    "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md border " +
                    (isUser
                      ? "bg-[#f8fafc] text-slate-900 border-slate-200"
                      // 🔹 Bolha da resposta ajustada para #154361
                      : "bg-[#154361] text-slate-50 border-slate-600/40")
                  }
                >
                  {/* Rótulo (Usuário / Publ.IA) */}
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
                    {isUser ? "Usuário" : "Publ.IA"}
                  </div>

                  {/* Conteúdo em Markdown, com margens mais discretas */}
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ node, ...props }) => (
                        <p className="mb-2 last:mb-0" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul
                          className="mb-2 list-disc pl-5 space-y-1"
                          {...props}
                        />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol
                          className="mb-2 list-decimal pl-5 space-y-1"
                          {...props}
                        />
                      ),
                      li: ({ node, ...props }) => <li {...props} />,
                      strong: ({ node, ...props }) => (
                        <strong className="font-semibold" {...props} />
                      ),
                      // 🔗 links em nova aba na página pública
                      a: ({ node, ...props }) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="underline underline-offset-2 hover:opacity-80"
                        />
                      ),
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
