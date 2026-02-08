"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isValidElement } from "react";
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

function extractText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) return extractText((node as any).props?.children);
  return "";
}

function isCsvHeading(text: string) {
  const t = (text || "").trim().toLowerCase();
  return (
    t === "versão em csv" ||
    t === "versao em csv" ||
    t === "versão em csv:" ||
    t === "versao em csv:"
  );
}

/**
 * Divide o conteúdo em:
 * - main: tudo antes do "Base legal"
 * - footer: de "Base legal" até o final (inclui "Referências oficiais consultadas")
 *
 * Aceita variações:
 * - "Base legal:"
 * - "## Base legal"
 * - "## Base legal:" etc.
 */
function splitMarkdownFooter(md: string): { main: string; footer: string } {
  const s = String(md ?? "");

  // encontra "Base legal" no início de linha (com ou sem ##, com ou sem :)
  const re = /(^|\n)\s*(##\s*)?Base\s+legal\b\s*:?\s*/i;
  const m = re.exec(s);
  if (!m) return { main: s, footer: "" };

  // início real do "Base legal..." (já incluindo "Base legal" no footer)
  const start = m.index + (m[1]?.length ?? 0); // pula apenas o \n capturado
  const main = s.slice(0, start).trimEnd();
  const footer = s.slice(start).trim();
  return { main, footer };
}

export function ChatMessages({
  messages,
  isLoading,
  onCopyLast,
  onRegenerateLast,
  onShareLast,
}: ChatMessagesProps) {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
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

              // ✅ sem hooks aqui (evita "Rendered more hooks...")
              const { main, footer } = isUser
                ? { main: msg.content, footer: "" }
                : splitMarkdownFooter(msg.content);

              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={[
                      "max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm",
                      isUser ? "bg-white text-gray-900" : "bg-[#28465b] text-gray-100",
                    ].join(" ")}
                  >
                    {isUser ? (
                      msg.content
                    ) : (
                      <>
                        {/* MAIN (normal) */}
                        <div className="markdown" data-copy-id={msg.id}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ node, ...props }) => (
                                <a
                                  {...props}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="underline underline-offset-2 hover:opacity-80"
                                />
                              ),

                              // remove "Versão em CSV" no conteúdo
                              h1: ({ node, ...props }) => {
                                const txt = extractText((props as any).children);
                                if (isCsvHeading(txt)) return null;
                                return <h1 {...props} />;
                              },
                              h2: ({ node, ...props }) => {
                                const txt = extractText((props as any).children);
                                if (isCsvHeading(txt)) return null;
                                return <h2 {...props} />;
                              },
                              h3: ({ node, ...props }) => {
                                const txt = extractText((props as any).children);
                                if (isCsvHeading(txt)) return null;
                                return <h3 {...props} />;
                              },
                              p: ({ node, ...props }) => {
                                const txt = extractText((props as any).children);
                                if (!txt.trim()) return null;
                                if (isCsvHeading(txt)) return null;
                                return <p {...props} />;
                              },

                              // ✅ suprime blocos CSV para não duplicar/gerar caixas
                              code: (p: any) => {
                                const { inline, className, children, ...props } = p as any;
                                const text = String(children ?? "");
                                const match = /language-(\w+)/.exec(className ?? "");
                                const lang = match?.[1]?.toLowerCase();

                                if (!inline && lang === "csv") return null;

                                // heurística: bloco grande com muitos ';' -> parece CSV
                                if (
                                  !inline &&
                                  text.trim().includes(";") &&
                                  text.trim().split("\n").length >= 2
                                ) {
                                  const semi = (text.match(/;/g) || []).length;
                                  if (semi >= 6) return null;
                                }

                                return (
                                  <code {...props} className="text-[12px]">
                                    {children}
                                  </code>
                                );
                              },
                              pre: ({ node, children, ...props }) => {
                                const txt = extractText(children);
                                if (!txt.trim()) return null;

                                const t = txt.trim();
                                const semi = (t.match(/;/g) || []).length;
                                const lines = t.split("\n").filter(Boolean).length;

                                // se parece CSV, não renderiza o "balão"
                                if (semi >= 6 && lines >= 2) return null;

                                return (
                                  <pre
                                    {...props}
                                    className="my-3 overflow-x-auto rounded-xl bg-black/20 p-3"
                                  >
                                    {children}
                                  </pre>
                                );
                              },
                            }}
                          >
                            {main}
                          </ReactMarkdown>
                        </div>

                        {/* FOOTER (Base legal + Referências) — 9px blindado */}
                        {footer.trim().length > 0 && (
                          <div className="publia-footnote mt-4 text-slate-100/90" data-footnote>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                a: ({ node, ...props }) => (
                                  <a
                                    {...props}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="underline underline-offset-2 hover:opacity-80"
                                  />
                                ),

                                // não faz sentido ter tabela/CSV no rodapé; se vier, ignora
                                table: () => null,
                                pre: () => null,
                                code: () => null,

                                // remove "Versão em CSV" também no rodapé
                                h1: ({ node, ...props }) => {
                                  const txt = extractText((props as any).children);
                                  if (isCsvHeading(txt)) return null;
                                  return (
                                    <p className="publia-footnote__heading">
                                      {(props as any).children}
                                    </p>
                                  );
                                },
                                h2: ({ node, ...props }) => {
                                  const txt = extractText((props as any).children);
                                  if (isCsvHeading(txt)) return null;
                                  return (
                                    <p className="publia-footnote__heading">
                                      {(props as any).children}
                                    </p>
                                  );
                                },
                                h3: ({ node, ...props }) => {
                                  const txt = extractText((props as any).children);
                                  if (isCsvHeading(txt)) return null;
                                  return (
                                    <p className="publia-footnote__heading">
                                      {(props as any).children}
                                    </p>
                                  );
                                },
                                p: ({ node, ...props }) => {
                                  const txt = extractText((props as any).children);
                                  if (!txt.trim()) return null;
                                  if (isCsvHeading(txt)) return null;
                                  return <p {...props} />;
                                },

                                // listas com marcador "-" (traço)
                                ul: ({ node, ...props }: any) => (
                                  <ul {...props} className="mt-2 space-y-1 list-none p-0" />
                                ),
                                ol: ({ node, ...props }: any) => (
                                  <ol {...props} className="mt-2 space-y-1 list-none p-0" />
                                ),
                                li: ({ node, ...props }: any) => (
                                  <li className="flex gap-2">
                                    <span className="shrink-0">-</span>
                                    <span className="min-w-0">{props.children}</span>
                                  </li>
                                ),
                              }}
                            >
                              {footer}
                            </ReactMarkdown>
                          </div>
                        )}
                      </>
                    )}
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
              onClick={() => onShareLast?.() ?? alert("Compartilhar ainda será implementado.")}
            >
              Compartilhar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
