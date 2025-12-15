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
  onRegenerateLast?: (lastUserMessage: string) => void | Promise<void>;
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
  onRegenerateLast,
  isSending,
}: ChatMessagesListProps) {
  let lastDateLabel: string | null = null;
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Última mensagem da IA e último texto do usuário (para regenerar)
  const lastAssistant = [...messages]
    .slice()
    .reverse()
    .find((m) => m.role === "assistant");
  const lastUser = [...messages]
    .slice()
    .reverse()
    .find((m) => m.role === "user");

  // Verificar se houve regeneração da MESMA pergunta
  const userMessages = messages.filter((m) => m.role === "user");
  const lastTwoUsers = userMessages.slice(-2);
  const isRegeneratedForSameQuestion =
    lastTwoUsers.length === 2 &&
    lastTwoUsers[0].content.trim() === lastTwoUsers[1].content.trim();

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
        const isLastAssistant = !!lastAssistant && msg.id === lastAssistant.id;

        const dateLabel = getDateLabel(msg.created_at);
        const showDateDivider = !!dateLabel && dateLabel !== lastDateLabel;

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
                  {/* Rótulo de resposta regenerada (só na última resposta da IA e quando há mesma pergunta repetida) */}
                  {onRegenerateLast &&
                    lastAssistant &&
                    msg.id === lastAssistant.id &&
                    isRegeneratedForSameQuestion && (
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200/80">
                        Resposta regenerada
                      </div>
                    )}

                  <div className="markdown text-[14px] leading-relaxed text-slate-50">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // 🔗 links em nova aba no chat principal (lista)
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
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Botões abaixo da resposta da IA, se existirem handlers */}
                {(onCopyAnswer || onShareConversation || onRegenerateLast) && (
                  <div className="mt-2 flex flex-col gap-2 text-xs">
                    {/* ✅ Indicador agora fica acima dos botões e só na última resposta da IA */}
                    {isLastAssistant && isSending && (
                      <div className="flex items-center gap-2 text-xs text-slate-100">
                        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-100" />
                        <span>Gerando resposta...</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {onCopyAnswer && (
                        <button
                          type="button"
                          onClick={() => onCopyAnswer(msg.id)}
                          className="rounded-full border border-white/60 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10"
                        >
                          Copiar
                        </button>
                      )}

                      {/* Regenerar só aparece na ÚLTIMA resposta da IA e se tivermos a última pergunta do usuário */}
                      {onRegenerateLast &&
                        lastAssistant &&
                        lastUser &&
                        msg.id === lastAssistant.id && (
                          <button
                            type="button"
                            onClick={() => onRegenerateLast(lastUser.content)}
                            className="rounded-full border border-white/60 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10"
                          >
                            Regenerar
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
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Âncora para scroll automático */}
      <div ref={bottomRef} />
    </div>
  );
}
