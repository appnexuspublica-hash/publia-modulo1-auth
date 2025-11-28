// src/app/p/[shareId]/page.tsx
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import {
  ChatMessagesList,
  ChatMessage,
} from "@/app/chat/components/ChatMessagesList";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ConversationRow = {
  id: string;
  title: string | null;
  is_shared: boolean;
  share_id: string;
};

interface SharedChatPageProps {
  params: {
    shareId: string;
  };
}

export default async function SharedChatPage({ params }: SharedChatPageProps) {
  const { shareId } = params;

  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .select("id, title, is_shared, share_id")
    .eq("share_id", shareId)
    .eq("is_shared", true)
    .single<ConversationRow>();

  if (convError || !conv) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#2f4f67] text-white">
        Conversa não encontrada ou não está compartilhada.
      </div>
    );
  }

  const { data: msgs, error: msgError } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true });

  if (msgError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#2f4f67] text-white">
        Erro ao carregar mensagens compartilhadas.
      </div>
    );
  }

  const messages: ChatMessage[] =
    (msgs ?? []).map((m) => ({
      id: m.id as string,
      role: m.role as "user" | "assistant",
      content: m.content as string,
      created_at: m.created_at as string,
    })) || [];

  const title =
    conv.title && conv.title.trim().length > 0
      ? conv.title.trim()
      : "Conversa compartilhada";

  return (
    <div className="flex min-h-screen flex-col bg-[#2f4f67]">
      {/* Header público */}
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 text-sm">
        <div className="flex items-center gap-2">
          {/* Logo igual ao sidebar */}
          <Image
            src="/logos/nexus.png"
            alt="Logo Publ.IA"
            width={28}
            height={28}
            className="rounded-lg"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold">Publ.IA</span>
            <span className="text-[11px] text-gray-500">
              Nexus Pública
            </span>
          </div>
        </div>

        <span className="text-xs text-gray-600">
          Visualização pública da conversa
        </span>
      </header>

      {/* Área principal */}
      <main className="flex flex-1 flex-col bg-[#2f4f67]">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-white">
            Nenhuma mensagem nesta conversa.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-8 py-10">
            {/* Título da conversa alinhado com a coluna de mensagens */}
            <div className="mx-auto mb-4 w-full max-w-3xl">
              <h1 className="text-base font-semibold text-white">
                {title}
              </h1>
              <p className="mt-1 text-xs text-slate-200/70">
                Esta é uma visualização somente leitura gerada pelo Publ.IA.
              </p>
            </div>

            <ChatMessagesList
              messages={messages}
              isSending={false}
            />
          </div>
        )}
      </main>
    </div>
  );
}
