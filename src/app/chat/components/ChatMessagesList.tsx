// src/app/chat/components/ChatMessagesList.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  isValidElement,
  createContext,
  useContext,
  useCallback,
} from "react";
import type { RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type Variant = "chat" | "share";

type ActionToast = { messageId: string; text: string } | null;

type ChatMessagesListProps = {
  messages: ChatMessage[];
  onCopyAnswer?: (messageId: string) => void | Promise<void>;

  // Compartilhar por mensagem (conversationId + messageId)
  onShareConversation?: (conversationId: string, messageId: string) => void | Promise<void>;

  onRegenerateLast?: (lastUserMessage: string) => void | Promise<void>;
  isSending: boolean;
  activePdfName?: string | null;

  variant?: Variant;
  activeConversationId?: string | null;
  scrollContainerRef?: RefObject<HTMLElement | null>;

  // Toast por mensagem (fica acima dos botões Copiar/Compartilhar)
  actionToast?: ActionToast;
};

const dateOnlyFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
});

const timeOnlyFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function getUserDateTimeLabel(created_at?: string): string | null {
  if (!created_at) return null;
  const d = new Date(created_at);
  if (Number.isNaN(d.getTime())) return null;

  const date = dateOnlyFormatter.format(d);
  const time = timeOnlyFormatter.format(d);
  return `${date} - ${time}h`;
}

function extractText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) return extractText((node as any).props?.children);
  return "";
}

// Downloads
async function downloadXlsxFromRows(rows: string[][], filename: string) {
  const res = await fetch("/api/export-xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, rows }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Falha ao gerar Excel.");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

// Theme
type MdTheme = {
  tableOuterBorder: string;
  tableClassWide: string;
  tableClassNormal: string;
  theadBg: string;
  thWide: string;
  thNormal: string;
  tdWide: string;
  tdNormal: string;
  btn: string;
  pre: string;
  link: string;
};

const THEME_CHAT: MdTheme = {
  tableOuterBorder: "w-full border border-white/10",
  tableClassWide: "min-w-max w-full border-collapse text-[13px]",
  tableClassNormal: "w-full table-auto border-collapse text-[13px]",
  theadBg: "bg-white/5",
  thWide: "whitespace-nowrap border border-white/15 px-3 py-2 text-left font-semibold",
  thNormal: "whitespace-normal break-words border border-white/15 px-3 py-2 text-left font-semibold",
  tdWide: "whitespace-nowrap border border-white/10 px-3 py-2 align-top",
  tdNormal: "whitespace-normal break-words border border-white/10 px-3 py-2 align-top",
  btn: "rounded-full border border-white/60 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10",
  pre: "my-3 overflow-x-auto rounded-xl bg-black/20 p-3",
  link: "text-inherit underline underline-offset-2 hover:opacity-80",
};

const THEME_SHARE: MdTheme = {
  tableOuterBorder: "w-full border border-slate-200/20",
  tableClassWide: "min-w-max w-full border-collapse text-[13px]",
  tableClassNormal: "w-full table-auto border-collapse text-[13px]",
  theadBg: "bg-slate-200/10",
  thWide: "whitespace-nowrap border border-slate-200/25 px-3 py-2 text-left font-semibold",
  thNormal: "whitespace-normal break-words border border-slate-200/25 px-3 py-2 text-left font-semibold",
  tdWide: "whitespace-nowrap border border-slate-200/15 px-3 py-2 align-top",
  tdNormal: "whitespace-normal break-words border border-slate-200/15 px-3 py-2 align-top",
  btn: "rounded-full border border-slate-200/50 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10",
  pre: "my-3 overflow-x-auto rounded-xl bg-black/25 p-3",
  link: "text-inherit underline underline-offset-2 hover:opacity-80",
};

const MarkdownThemeContext = createContext<MdTheme>(THEME_CHAT);
function useMdTheme() {
  return useContext(MarkdownThemeContext);
}

const TableLayoutContext = createContext<{ isWide: boolean }>({ isWide: false });
function useTableLayout() {
  return useContext(TableLayoutContext);
}

function tableElementToMatrix(tableEl: HTMLTableElement): string[][] {
  const trs = Array.from(tableEl.querySelectorAll("tr"));
  return trs.map((tr) =>
    Array.from(tr.querySelectorAll("th,td")).map((cell) => (cell.textContent ?? "").trim())
  );
}

function TableWithDownloads({
  index,
  children,
  tableProps,
}: {
  index: number;
  children: React.ReactNode;
  tableProps: React.TableHTMLAttributes<HTMLTableElement>;
}) {
  const theme = useMdTheme();
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [isWide, setIsWide] = useState(false);

  const COL_THRESHOLD = 8;

  useEffect(() => {
    const el = tableRef.current;
    if (!el) {
      setIsWide(false);
      return;
    }

    const trs = Array.from(el.querySelectorAll("tr"));
    let maxCols = 0;
    for (const tr of trs) {
      const cols = tr.querySelectorAll("th, td").length;
      if (cols > maxCols) maxCols = cols;
    }

    setIsWide(maxCols >= COL_THRESHOLD);
  }, [children]);

  return (
    <TableLayoutContext.Provider value={{ isWide }}>
      <div className="my-3 w-full">
        <div className={theme.tableOuterBorder}>
          <div className={isWide ? "w-full overflow-x-auto" : "w-full overflow-hidden"}>
            <table
              {...tableProps}
              ref={tableRef}
              className={isWide ? theme.tableClassWide : theme.tableClassNormal}
            >
              {children}
            </table>
          </div>
        </div>

        {/* Somente 1 botão: Baixar Tabela/Planilha (Excel) */}
        <div className="mt-2 flex flex-wrap items-center justify-start gap-2 text-[11px] text-slate-100/90">
          <button
            type="button"
            onClick={async () => {
              try {
                const el = tableRef.current;
                if (!el) return;
                const matrix = tableElementToMatrix(el);
                await downloadXlsxFromRows(matrix, `tabela-${index}.xlsx`);
              } catch (e: any) {
                alert(e?.message || "Erro ao gerar planilha.");
              }
            }}
            className={theme.btn}
          >
            Baixar Tabela/Planilha
          </button>
        </div>
      </div>
    </TableLayoutContext.Provider>
  );
}

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;

  let p: HTMLElement | null = el.parentElement;
  while (p) {
    const style = window.getComputedStyle(p);
    const overflowY = style.overflowY;
    const isCandidate = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
    if (isCandidate) return p;
    p = p.parentElement;
  }

  return (document.scrollingElement as HTMLElement | null) ?? null;
}

function isCsvHeading(text: string) {
  const t = (text || "").trim().toLowerCase();
  return t === "versão em csv" || t === "versao em csv" || t === "versão em csv:" || t === "versao em csv:";
}

/**
 * Divide o conteúdo em:
 * - main: tudo antes do "Base legal"
 * - footer: de "Base legal" até o final
 *
 * Aceita variações:
 * - "Base legal:"
 * - "## Base legal"
 * - "## Base legal:" etc.
 */
function splitMarkdownFooter(md: string): { main: string; footer: string } {
  const s = String(md ?? "");
  // pega o primeiro "Base legal" no início de linha
  const re = /(^|\n)(##\s*)?Base\s+legal\b\s*:?\s*/i;
  const m = re.exec(s);
  if (!m) return { main: s, footer: "" };

  const start = (m.index ?? 0) + (m[1]?.length ?? 0); // aponta para "Base..."
  const main = s.slice(0, start).trimEnd();
  const footer = s.slice(start).trim();
  return { main, footer };
}

export function ChatMessagesList({
  messages,
  onCopyAnswer,
  onShareConversation,
  onRegenerateLast,
  isSending,
  variant = "chat",
  scrollContainerRef,
  activeConversationId,
  actionToast = null,
}: ChatMessagesListProps) {
  const theme = variant === "share" ? THEME_SHARE : THEME_CHAT;

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unread, setUnread] = useState(0);

  const isAtBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  const lastAssistant = [...messages].slice().reverse().find((m) => m.role === "assistant");
  const lastUser = [...messages].slice().reverse().find((m) => m.role === "user");

  const userMessages = messages.filter((m) => m.role === "user");
  const lastTwoUsers = userMessages.slice(-2);
  const isRegeneratedForSameQuestion =
    lastTwoUsers.length === 2 && lastTwoUsers[0].content.trim() === lastTwoUsers[1].content.trim();

  const BOTTOM_THRESHOLD_PX = 120;

  const computeAtBottom = useCallback((sp: HTMLElement | null) => {
    if (!sp) return true;
    const dist = sp.scrollHeight - sp.scrollTop - sp.clientHeight;
    return dist <= BOTTOM_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const forced = scrollContainerRef?.current ?? null;
    const sp = forced ?? getScrollParent(bottomRef.current);
    scrollParentRef.current = sp;

    if (!sp) return;

    lastScrollTopRef.current = sp.scrollTop;
    const initialAtBottom = computeAtBottom(sp);
    isAtBottomRef.current = initialAtBottom;
    setIsAtBottom(initialAtBottom);
    if (initialAtBottom) setUnread(0);

    const onScroll = () => {
      const top = sp.scrollTop;
      const prevTop = lastScrollTopRef.current;
      lastScrollTopRef.current = top;

      const userScrolledUp = top < prevTop - 2;
      const atBottomNow = userScrolledUp ? false : computeAtBottom(sp);

      isAtBottomRef.current = atBottomNow;
      setIsAtBottom(atBottomNow);

      if (atBottomNow) setUnread(0);
    };

    sp.addEventListener("scroll", onScroll, { passive: true });
    return () => sp.removeEventListener("scroll", onScroll);
  }, [computeAtBottom, scrollContainerRef]);

  useEffect(() => {
    if (!isAtBottomRef.current) {
      setIsAtBottom(false);
      setUnread((u) => Math.min(u + 1, 99));
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages, isSending]);

  const jumpToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    isAtBottomRef.current = true;
    setUnread(0);
    setIsAtBottom(true);

    const sp = scrollParentRef.current;
    if (sp) lastScrollTopRef.current = sp.scrollTop;
  };

  // Compartilhar válido somente no chat e somente se tiver conversationId ativo
  const canShare =
    variant === "chat" &&
    typeof activeConversationId === "string" &&
    activeConversationId.trim().length > 0 &&
    typeof onShareConversation === "function";

  return (
    <MarkdownThemeContext.Provider value={theme}>
      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isLastAssistant = !!lastAssistant && msg.id === lastAssistant.id;

          // importante: manter fora do ReactMarkdown para não resetar indevidamente
          let tableIndex = 0;

          const userBubble =
            variant === "share" ? "bg-[#0d4161] text-white" : "bg-[#1c4561] text-white";

          const assistantBubble =
            variant === "share" ? "bg-[#274d69] text-slate-50" : "bg-[#2b4e67] text-slate-50";

          const { main, footer } = useMemo(() => splitMarkdownFooter(msg.content), [msg.content]);

          const markdownComponentsMain: any = {
            a: ({ node, ...props }: any) => (
              <a {...props} target="_blank" rel="noreferrer noopener" className={theme.link} />
            ),
            hr: () => <div className="my-4 h-px w-full bg-white/20" />,

            // Remove “Versão em CSV”
            h1: ({ node, ...props }: any) => {
              const txt = extractText((props as any).children);
              if (isCsvHeading(txt)) return null;
              return <h1 {...props} />;
            },
            h2: ({ node, ...props }: any) => {
              const txt = extractText((props as any).children);
              if (isCsvHeading(txt)) return null;
              return <h2 {...props} />;
            },
            h3: ({ node, ...props }: any) => {
              const txt = extractText((props as any).children);
              if (isCsvHeading(txt)) return null;
              return <h3 {...props} />;
            },

            p: ({ node, ...props }: any) => {
              const txt = extractText((props as any).children);
              if (!txt.trim()) return null;
              if (isCsvHeading(txt)) return null;
              return <p {...props} />;
            },

            table: ({ node, ...props }: any) => {
              tableIndex += 1;
              return (
                <TableWithDownloads index={tableIndex} tableProps={props}>
                  {props.children}
                </TableWithDownloads>
              );
            },
            thead: ({ node, ...props }: any) => <thead {...props} className={theme.theadBg} />,
            th: ({ node, ...props }: any) => {
              const { isWide } = useTableLayout();
              return <th {...props} className={isWide ? theme.thWide : theme.thNormal} />;
            },
            td: ({ node, ...props }: any) => {
              const { isWide } = useTableLayout();
              return <td {...props} className={isWide ? theme.tdWide : theme.tdNormal} />;
            },

            // NÃO renderizar blocos CSV (evita tabela duplicada + balão vazio)
            code: (p: any) => {
              const { inline, className, children, ...props } = p as any;
              const text = String(children ?? "");
              const match = /language-(\w+)/.exec(className ?? "");
              const lang = match?.[1]?.toLowerCase();

              if (!inline && lang === "csv") return null;

              // heurística: suprime blocos que parecem CSV grande
              if (!inline && text.trim().includes(";") && text.trim().split("\n").length >= 2) {
                const semi = (text.match(/;/g) || []).length;
                if (semi >= 6) return null;
              }

              return (
                <code {...props} className="text-[12px]">
                  {children}
                </code>
              );
            },

            pre: ({ node, children, ...props }: any) => {
              const txt = extractText(children);
              if (!txt.trim()) return null;

              const t = txt.trim();
              const semi = (t.match(/;/g) || []).length;
              const lines = t.split("\n").filter(Boolean).length;
              if (semi >= 6 && lines >= 2) return null;

              return (
                <pre {...props} className={theme.pre}>
                  {children}
                </pre>
              );
            },
          };

          const markdownComponentsFooter: any = {
            a: ({ node, ...props }: any) => (
              <a {...props} target="_blank" rel="noreferrer noopener" className={theme.link} />
            ),

            // não faz sentido ter tabela/CSV no rodapé; se vier, ignora
            table: () => null,
            pre: () => null,
            code: () => null,

            // remove headings "Versão em CSV" caso apareça
            h1: ({ node, ...props }: any) => {
              const txt = extractText((props as any).children);
              if (isCsvHeading(txt)) return null;
              return <h1 {...props} />;
            },
            h2: ({ node, ...props }: any) => {
              const txt = extractText((props as any).children);
              if (isCsvHeading(txt)) return null;
              return <h2 {...props} />;
            },
            h3: ({ node, ...props }: any) => {
              const txt = extractText((props as any).children);
              if (isCsvHeading(txt)) return null;
              return <h3 {...props} />;
            },

            // LISTA COM TRAÇO (-)
            ul: ({ node, ...props }: any) => <ul {...props} className="mt-2 space-y-1" />,
            ol: ({ node, ...props }: any) => <ol {...props} className="mt-2 space-y-1" />,
            li: ({ node, ...props }: any) => (
              <li className="flex gap-2">
                <span className="shrink-0">-</span>
                <span className="min-w-0">{props.children}</span>
              </li>
            ),
          };

          return (
            <div key={msg.id}>
              {isUser ? (
                <div className="flex flex-col items-start">
                  {/* Data + hora SOMENTE da pergunta */}
                  {getUserDateTimeLabel(msg.created_at) && (
                    <div className="mb-2 text-[11px] font-semibold text-slate-200/90">
                      {getUserDateTimeLabel(msg.created_at)}
                    </div>
                  )}

                  <div className={"inline-block max-w-[80%] rounded-xl px-5 py-2 " + userBubble}>
                    <p className="whitespace-pre-line text-[14px] leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-start">
                  <div className={"w-full rounded-3xl px-6 py-4 shadow-md " + assistantBubble}>
                    {onRegenerateLast &&
                      lastAssistant &&
                      msg.id === lastAssistant.id &&
                      isRegeneratedForSameQuestion && (
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200/80">
                          Resposta regenerada
                        </div>
                      )}

                    {/* MAIN */}
                    <div className="markdown text-[14px] leading-relaxed" data-copy-id={msg.id}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponentsMain}>
                        {main}
                      </ReactMarkdown>
                    </div>

                    {/* FOOTER (Base legal + Referências) em 9px */}
                    {footer.trim().length > 0 && (
                      <div className="mt-4 text-[9px] leading-snug text-slate-100/90">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponentsFooter}
                        >
                          {footer}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {(onCopyAnswer || onRegenerateLast || canShare) && (
                    <div className="mt-2 flex w-full flex-col gap-2 text-xs">
                      {/* Toast por mensagem (acima dos botões) */}
                      {actionToast?.messageId === msg.id && (
                        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-slate-100">
                          {actionToast.text}
                        </div>
                      )}

                      {isLastAssistant && isSending && (
                        <div className="flex items-center gap-2 text-xs text-slate-100">
                          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-100" />
                          <span>Gerando resposta...</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {onCopyAnswer && (
                          <button
                            type="button"
                            onClick={() => onCopyAnswer(msg.id)}
                            className={theme.btn}
                          >
                            Copiar
                          </button>
                        )}

                        {canShare && (
                          <button
                            type="button"
                            onClick={() => onShareConversation!(activeConversationId!.trim(), msg.id)}
                            className={theme.btn}
                          >
                            Compartilhar
                          </button>
                        )}

                        {onRegenerateLast && lastAssistant && lastUser && msg.id === lastAssistant.id && (
                          <button
                            type="button"
                            onClick={() => onRegenerateLast(lastUser.content)}
                            className={theme.btn}
                          >
                            Regenerar
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

        <div ref={bottomRef} />

        {!isAtBottom && unread > 0 && (
          <button
            type="button"
            onClick={jumpToBottom}
            className="fixed bottom-6 right-6 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-700"
          >
            Ir para o final ({unread})
          </button>
        )}
      </div>
    </MarkdownThemeContext.Provider>
  );
}

