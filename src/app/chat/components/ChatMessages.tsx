"use client";

import { ChatEmptyState } from "./ChatEmptyState";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onCopyLast?: (text: string) => void;
  onRegenerateLast?: (lastUserMessage: string) => void;
  onShareLast?: () => void;
}

export function ChatMessages({
  messages,
  isLoading,
  onCopyLast,
  onRegenerateLast,
  onShareLast,
}: ChatMessagesProps) {
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!hasMessages ? (
          <ChatEmptyState />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {messages.map((msg) => {
              const isUser = msg.role === "user";

              return (
                <div
                  key={msg.id}
                  className={`flex ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={[
                      "max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm",
                      isUser
                        ? "bg-white text-gray-900"
                        : "bg-[#28465b] text-gray-100",
                    ].join(" ")}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-100">
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border border-white border-t-transparent" />
                <span>Aguarde, processando a resposta...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botões após a última resposta da IA */}
      {!isLoading && lastAssistant && (
        <div className="border-t border-gray-700/40 bg-[#2f4f67] px-4 py-2">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-white/60 px-3 py-1 text-xs font-medium text-white hover:bg-white/10"
              onClick={() => onCopyLast?.(lastAssistant.content)}
            >
              Copiar resposta
            </button>

            {lastUser && (
              <button
                type="button"
                className="rounded-full border border-white/60 px-3 py-1 text-xs font-medium text-white hover:bg-white/10"
                onClick={() => onRegenerateLast?.(lastUser.content)}
              >
                Regenerar resposta
              </button>
            )}

            <button
              type="button"
              className="rounded-full border border-white/60 px-3 py-1 text-xs font-medium text-white hover:bg-white/10"
              onClick={() =>
                onShareLast?.() ?? alert("Compartilhar ainda será implementado.")
              }
            >
              Compartilhar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
