// src/app/chat/components/ChatMessagesList.tsx
"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type ChatMessagesListProps = {
  messages: ChatMessage[];
  onCopyAnswer?: (messageId: string) => void | Promise<void>;
  onShareConversation?: () => void;
  isSending: boolean;
  activePdfName?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
});

function getDateLabel(created_at?: string): string | null {
  if (!created_at) return null;
  const d = new Date(created_at);
  if (Number.isNaN(d.getTime())) return null;
  return dateFormatter.format(d);
}

export function ChatMessagesList({
  messages,
  onCopyAnswer,
  onShareConversation,
  isSending,
}: ChatMessagesListProps) {
  let lastDateLabel: string | null = null;
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Scroll automático para a última mensagem
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages.length, isSending]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const dateLabel = getDateLabel(msg.created_at);
        const showDateDivider =
          !!dateLabel && dateLabel !== lastDateLabel;

        if (showDateDivider) {
          lastDateLabel = dateLabel!;
        }

        return (
          <div key={msg.id}>
            {/* Divisor de data simples, alinhado à esquerda */}
            {showDateDivider && (
              <div className="my-4 text-[11px] font-semibold text-slate-300">
                {dateLabel}
              </div>
            )}

            {/* Balão do usuário */}
            {isUser ? (
              <div className="flex justify-start">
                <div className="inline-block max-w-[80%] rounded-2xl bg-[#f5f5f5] px-4 py-2 shadow-sm">
                  <p className="whitespace-pre-line text-[14px] leading-relaxed text-slate-900">
                    {msg.content}
                  </p>
                </div>
              </div>
            ) : (
              // Balão da IA
              <div className="flex flex-col items-start">
                <div className="w-full rounded-3xl border border-slate-600/40 bg-[#224761] px-6 py-4 shadow-md">
                  <div className="markdown text-[14px] leading-relaxed text-slate-50">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Botões abaixo da resposta da IA, se existirem handlers */}
                {(onCopyAnswer || onShareConversation) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {onCopyAnswer && (
                      <button
                        type="button"
                        onClick={() => onCopyAnswer(msg.id)}
                        className="rounded-full border border-white/60 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10"
                      >
                        Copiar
                      </button>
                    )}
                    {onShareConversation && (
                      <button
                        type="button"
                        onClick={() => onShareConversation()}
                        className="rounded-full border border-white/60 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10"
                      >
                        Compartilhar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Indicador “Processando resposta...” */}
      {isSending && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-100">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-100" />
          <span>Processando resposta...</span>
        </div>
      )}

      {/* Âncora para scroll automático */}
      <div ref={bottomRef} />
    </div>
  );
}
