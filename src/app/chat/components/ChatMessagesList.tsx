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
  Children,
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

type ChatMessagesListProps = {
  messages: ChatMessage[];

  onCopyAnswer?: (messageId: string) => void | Promise<void>;

  // ✅ recebe o conversationId explicitamente
  onShareConversation?: (conversationId: string) => void | Promise<void>;

  onRegenerateLast?: (lastUserMessage: string) => void | Promise<void>;
  isSending: boolean;
  activePdfName?: string | null;

  variant?: Variant;

  // ✅ conversa ativa
  activeConversationId?: string | null;

  // ✅ container REAL de scroll
  scrollContainerRef?: RefObject<HTMLElement | null>;
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

function extractText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) return extractText((node as any).props?.children);
  return "";
}

// ----------------------------------------------------
// Helpers: Downloads
// ----------------------------------------------------
function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function sanitizeFilenameBase(name: string) {
  return (name || "planilha")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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

// ----------------------------------------------------
// CSV: parse robusto (aspas, ; ou ,) + heurística
// ----------------------------------------------------
function detectDelimiter(text: string): ";" | "," {
  const semi = (text.match(/;/g) || []).length;
  const comma = (text.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
}

function parseCsv(csvTextRaw: string): { delimiter: string; rows: string[][] } {
  const csvText = (csvTextRaw || "").replace(/\r\n/g, "\n").trim();
  if (!csvText) return { delimiter: ";", rows: [] };

  const delimiter = detectDelimiter(csvText);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = csvText[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += ch;
  }

  row.push(field);
  rows.push(row);

  const cleaned = rows.filter((r) => r.some((c) => (c ?? "").trim() !== ""));
  return { delimiter, rows: cleaned };
}

function looksLikeCsvText(textRaw: string): boolean {
  const text = (textRaw || "").trim();
  if (!text) return false;

  const hasManySemicolons = (text.match(/;/g) || []).length >= 6;
  const hasManyCommas = (text.match(/,/g) || []).length >= 8;

  const hasNewline = text.includes("\n");
  const firstLine = text.split("\n")[0] || "";
  const colsSemi = firstLine.split(";").length;
  const colsComma = firstLine.split(",").length;

  const looksTabular =
    (colsSemi >= 4 && hasManySemicolons) || (colsComma >= 4 && hasManyCommas);

  const oneHugeLine =
    !hasNewline && (colsSemi >= 6 || colsComma >= 8) && text.length >= 40;

  return looksTabular || oneHugeLine;
}

function toCsvFromRows(rows: string[][], delimiter = ";") {
  const esc = (v: string) => {
    const s = (v ?? "").toString();
    if (s.includes('"') || s.includes("\n") || s.includes(delimiter)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return rows.map((r) => (r ?? []).map(esc).join(delimiter)).join("\n");
}

// ----------------------------------------------------
// Tema visual (chat vs share) + context
// ----------------------------------------------------
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

// ----------------------------------------------------
// Contexto por tabela
// ----------------------------------------------------
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

        <div className="mt-2 flex flex-wrap items-center justify-start gap-2 text-[11px] text-slate-100/90">
          <button
            type="button"
            onClick={() => {
              const el = tableRef.current;
              if (!el) return;
              const matrix = tableElementToMatrix(el);
              const csv = toCsvFromRows(matrix, ";");
              downloadTextFile(`tabela-${index}.csv`, csv, "text/csv;charset=utf-8");
            }}
            className={theme.btn}
          >
            Baixar CSV
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                const el = tableRef.current;
                if (!el) return;
                const matrix = tableElementToMatrix(el);
                await downloadXlsxFromRows(matrix, `tabela-${index}.xlsx`);
              } catch (e: any) {
                alert(e?.message || "Erro ao gerar Excel.");
              }
            }}
            className={theme.btn}
          >
            Baixar Excel
          </button>
        </div>
      </div>
    </TableLayoutContext.Provider>
  );
}

function CsvPreviewTable({
  rows,
  maxRows = 30,
  maxCols = 18,
}: {
  rows: string[][];
  maxRows?: number;
  maxCols?: number;
}) {
  const theme = useMdTheme();
  if (!rows || rows.length === 0) return null;

  const head = rows[0] ?? [];
  const body = rows.slice(1);

  const clippedHead = head.slice(0, maxCols);
  const clippedBody = body.slice(0, maxRows).map((r) => (r ?? []).slice(0, maxCols));

  const isWide = (head?.length ?? 0) >= 8;

  return (
    <div className={isWide ? "w-full overflow-x-auto" : "w-full overflow-hidden"}>
      <table className={isWide ? theme.tableClassWide : theme.tableClassNormal}>
        <thead className={theme.theadBg}>
          <tr>
            {clippedHead.map((h, i) => (
              <th key={i} className={isWide ? theme.thWide : theme.thNormal}>
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {clippedBody.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className={isWide ? theme.tdWide : theme.tdNormal}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {(rows.length - 1 > maxRows || head.length > maxCols) && (
        <div className="mt-2 px-1 text-[11px] text-slate-200/80">
          Mostrando prévia ({Math.min(rows.length - 1, maxRows)} linhas /{" "}
          {Math.min(head.length, maxCols)} colunas). Baixe para ver completo.
        </div>
      )}
    </div>
  );
}

function CsvBlockWithDownloads({ index, csvText }: { index: number; csvText: string }) {
  const theme = useMdTheme();
  const { delimiter, rows } = useMemo(() => parseCsv(csvText), [csvText]);

  if (!rows || rows.length === 0) return null;

  const baseName = sanitizeFilenameBase(`planilha-${index}`);
  const csvForDownload = (csvText || "").trim();

  return (
    <div className="my-3 w-full">
      <div className={theme.tableOuterBorder}>
        <div className="px-3 py-3">
          <CsvPreviewTable rows={rows} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-start gap-2 text-[11px] text-slate-100/90">
        <button
          type="button"
          onClick={() =>
            downloadTextFile(
              `${baseName}.csv`,
              csvForDownload || toCsvFromRows(rows, delimiter as any),
              "text/csv;charset=utf-8"
            )
          }
          className={theme.btn}
        >
          Baixar CSV
        </button>

        <button
          type="button"
          onClick={async () => {
            try {
              await downloadXlsxFromRows(rows, `${baseName}.xlsx`);
            } catch (e: any) {
              alert(e?.message || "Erro ao gerar Excel.");
            }
          }}
          className={theme.btn}
        >
          Baixar Excel
        </button>
      </div>
    </div>
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

export function ChatMessagesList({
  messages,
  onCopyAnswer,
  onShareConversation,
  onRegenerateLast,
  isSending,
  variant = "chat",
  scrollContainerRef,
  activeConversationId,
}: ChatMessagesListProps) {
  const theme = variant === "share" ? THEME_SHARE : THEME_CHAT;

  let lastDateLabel: string | null = null;

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

  return (
    <MarkdownThemeContext.Provider value={theme}>
      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isLastAssistant = !!lastAssistant && msg.id === lastAssistant.id;

          const dateLabel = getDateLabel(msg.created_at);
          const showDateDivider = !!dateLabel && dateLabel !== lastDateLabel;
          if (showDateDivider) lastDateLabel = dateLabel!;

          let tableIndex = 0;
          let csvIndex = 0;

          const userBubble =
            variant === "share" ? "bg-[#0d4161] text-white" : "bg-[#1c4561] text-white";

          const assistantBubble =
            variant === "share"
              ? "bg-[#274d69] text-slate-50"
              : "bg-[#2b4e67] text-slate-50";

          return (
            <div key={msg.id}>
              {showDateDivider && (
                <div className="my-4 text-[11px] font-semibold text-slate-300">{dateLabel}</div>
              )}

              {isUser ? (
                <div className="flex justify-start">
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

                    <div className="markdown text-[14px] leading-relaxed" data-copy-id={msg.id}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node, ...props }) => (
                            <a
                              {...props}
                              target="_blank"
                              rel="noreferrer noopener"
                              className={theme.link}
                            />
                          ),
                          hr: () => <div className="my-4 h-px w-full bg-white/20" />,
                          p: ({ node, ...props }) => {
                            const txt = extractText((props as any).children);
                            if (!txt.trim()) return null;
                            return <p {...props} />;
                          },
                          table: ({ node, ...props }) => {
                            tableIndex += 1;
                            return (
                              <TableWithDownloads index={tableIndex} tableProps={props}>
                                {props.children}
                              </TableWithDownloads>
                            );
                          },
                          thead: ({ node, ...props }) => <thead {...props} className={theme.theadBg} />,
                          th: ({ node, ...props }) => {
                            const { isWide } = useTableLayout();
                            return <th {...props} className={isWide ? theme.thWide : theme.thNormal} />;
                          },
                          td: ({ node, ...props }) => {
                            const { isWide } = useTableLayout();
                            return <td {...props} className={isWide ? theme.tdWide : theme.tdNormal} />;
                          },
                          code: (p: any) => {
                            const { inline, className, children, ...props } = p as any;

                            const text = String(children ?? "");
                            const match = /language-(\w+)/.exec(className ?? "");
                            const lang = match?.[1]?.toLowerCase();

                            const disguisedCsv =
                              !inline && (!lang || lang === "text") && looksLikeCsvText(text);

                            if (!inline && lang === "csv") {
                              csvIndex += 1;
                              return <CsvBlockWithDownloads index={csvIndex} csvText={text} />;
                            }

                            if (!inline && disguisedCsv) {
                              csvIndex += 1;
                              return <CsvBlockWithDownloads index={csvIndex} csvText={text} />;
                            }

                            return (
                              <code {...props} className="text-[12px]">
                                {children}
                              </code>
                            );
                          },
                          pre: ({ node, children, ...props }) => {
                            const arr = Children.toArray(children);
                            if (arr.length === 0) return null;

                            if (arr.length === 1 && isValidElement(arr[0])) {
                              const el: any = arr[0];
                              if (typeof el.type !== "string") return <>{children}</>;
                            }

                            const txt = extractText(children);
                            if (!txt.trim()) return null;

                            return (
                              <pre {...props} className={theme.pre}>
                                {children}
                              </pre>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {(onCopyAnswer || onShareConversation || onRegenerateLast) && (
                    <div className="mt-2 flex w-full flex-col gap-2 text-xs">
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

                        {onRegenerateLast && lastAssistant && lastUser && msg.id === lastAssistant.id && (
                          <button
                            type="button"
                            onClick={() => onRegenerateLast(lastUser.content)}
                            className={theme.btn}
                          >
                            Regenerar
                          </button>
                        )}

                        {/* ✅ Compartilha SEMPRE a conversa ativa */}
                        {onShareConversation && activeConversationId && (
                          <button
                            type="button"
                            onClick={() => onShareConversation(activeConversationId)}
                            className={theme.btn}
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
