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
} from "react";
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

// ✅ Helper: extrair texto real de children (para detectar <pre>/<p> “vazio”)
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

// Backend gera o XLSX (Node) e o browser só baixa
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
  a.download = filename.toLowerCase().endsWith(".xlsx")
    ? filename
    : `${filename}.xlsx`;
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
// Contexto por tabela (pra alternar wrap/scroll por colunas)
// ----------------------------------------------------
const TableLayoutContext = createContext<{ isWide: boolean }>({ isWide: false });
function useTableLayout() {
  return useContext(TableLayoutContext);
}

// ----------------------------------------------------
// Tabela Markdown: downloads abaixo + modo híbrido
// ----------------------------------------------------
function tableElementToMatrix(tableEl: HTMLTableElement): string[][] {
  const trs = Array.from(tableEl.querySelectorAll("tr"));
  return trs.map((tr) =>
    Array.from(tr.querySelectorAll("th,td")).map((cell) =>
      (cell.textContent ?? "").trim()
    )
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
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [isWide, setIsWide] = useState(false);

  // ✅ híbrido: até 7 colunas -> quebra linha / 8+ -> scroll
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
      <div className="my-3 w-full rounded-xl border border-white/10">
        <div className={isWide ? "w-full overflow-x-auto" : "w-full overflow-hidden"}>
          <table
            {...tableProps}
            ref={tableRef}
            className={
              isWide
                ? "min-w-max w-full border-collapse text-[13px]"
                : "w-full table-fixed border-collapse text-[13px]"
            }
          >
            {children}
          </table>
        </div>

        {/* ✅ Barra solta: só botões */}
        <div className="flex flex-wrap items-center justify-start gap-2 px-3 py-2 text-[11px] text-slate-100/90">
          <button
            type="button"
            onClick={() => {
              const el = tableRef.current;
              if (!el) return;
              const matrix = tableElementToMatrix(el);
              const csv = toCsvFromRows(matrix, ";");
              downloadTextFile(`tabela-${index}.csv`, csv, "text/csv;charset=utf-8");
            }}
            className="rounded-full border border-white/60 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10"
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
            className="rounded-full border border-white/60 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10"
          >
            Baixar Excel
          </button>
        </div>
      </div>
    </TableLayoutContext.Provider>
  );
}

// ----------------------------------------------------
// CSV block: preview em tabela + downloads
// ----------------------------------------------------
function CsvPreviewTable({
  rows,
  maxRows = 30,
  maxCols = 18,
}: {
  rows: string[][];
  maxRows?: number;
  maxCols?: number;
}) {
  if (!rows || rows.length === 0) return null;

  const head = rows[0] ?? [];
  const body = rows.slice(1);

  const clippedHead = head.slice(0, maxCols);
  const clippedBody = body
    .slice(0, maxRows)
    .map((r) => (r ?? []).slice(0, maxCols));

  const isWide = (head?.length ?? 0) >= 8;

  return (
    <div className={isWide ? "w-full overflow-x-auto" : "w-full overflow-hidden"}>
      <table
        className={
          isWide
            ? "min-w-max w-full border-collapse text-[13px]"
            : "w-full table-fixed border-collapse text-[13px]"
        }
      >
        <thead className="bg-white/5">
          <tr>
            {clippedHead.map((h, i) => (
              <th
                key={i}
                className={
                  isWide
                    ? "whitespace-nowrap border border-white/15 px-3 py-2 text-left font-semibold"
                    : "whitespace-normal break-words border border-white/15 px-3 py-2 text-left font-semibold"
                }
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {clippedBody.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={
                    isWide
                      ? "whitespace-nowrap border border-white/10 px-3 py-2 align-top"
                      : "whitespace-normal break-words border border-white/10 px-3 py-2 align-top"
                  }
                >
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
  const { delimiter, rows } = useMemo(() => parseCsv(csvText), [csvText]);

  if (!rows || rows.length === 0) return null;

  const baseName = sanitizeFilenameBase(`planilha-${index}`);
  const csvForDownload = (csvText || "").trim();

  return (
    <div className="my-3 w-full rounded-xl border border-white/10">
      <div className="px-3 pt-3">
        <CsvPreviewTable rows={rows} />
      </div>

      <div className="flex flex-wrap items-center justify-start gap-2 px-3 pb-3 pt-2 text-[11px] text-slate-100/90">
        <button
          type="button"
          onClick={() =>
            downloadTextFile(
              `${baseName}.csv`,
              csvForDownload || toCsvFromRows(rows, delimiter as any),
              "text/csv;charset=utf-8"
            )
          }
          className="rounded-full border border-white/60 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10"
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
          className="rounded-full border border-white/60 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10"
        >
          Baixar Excel
        </button>
      </div>
    </div>
  );
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

  const lastAssistant = [...messages]
    .slice()
    .reverse()
    .find((m) => m.role === "assistant");
  const lastUser = [...messages].slice().reverse().find((m) => m.role === "user");

  const userMessages = messages.filter((m) => m.role === "user");
  const lastTwoUsers = userMessages.slice(-2);
  const isRegeneratedForSameQuestion =
    lastTwoUsers.length === 2 &&
    lastTwoUsers[0].content.trim() === lastTwoUsers[1].content.trim();

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, isSending]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const isLastAssistant = !!lastAssistant && msg.id === lastAssistant.id;

        const dateLabel = getDateLabel(msg.created_at);
        const showDateDivider = !!dateLabel && dateLabel !== lastDateLabel;
        if (showDateDivider) lastDateLabel = dateLabel!;

        let tableIndex = 0;
        let csvIndex = 0;

        return (
          <div key={msg.id}>
            {showDateDivider && (
              <div className="my-4 text-[11px] font-semibold text-slate-300">{dateLabel}</div>
            )}

            {isUser ? (
              <div className="flex justify-start">
                <div className="inline-block max-w-[80%] rounded-2xl bg-[#f5f5f5] px-4 py-2 shadow-sm">
                  <p className="whitespace-pre-line text-[14px] leading-relaxed text-slate-900">
                    {msg.content}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start">
                <div className="w-full rounded-3xl border border-slate-600/40 bg-[#224761] px-6 py-4 shadow-md">
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
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="underline underline-offset-2 hover:opacity-80"
                          />
                        ),

                        // ✅ Corrige “barra/balão fantasma” vindo de `---` (hr)
                        hr: () => <div className="my-4 h-px w-full bg-white/20" />,

                        // ✅ Remove parágrafos vazios
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

                        thead: ({ node, ...props }) => <thead {...props} className="bg-white/5" />,

                        th: ({ node, ...props }) => {
                          const { isWide } = useTableLayout();
                          return (
                            <th
                              {...props}
                              className={
                                isWide
                                  ? "whitespace-nowrap border border-white/15 px-3 py-2 text-left font-semibold"
                                  : "whitespace-normal break-words border border-white/15 px-3 py-2 text-left font-semibold"
                              }
                            />
                          );
                        },

                        td: ({ node, ...props }) => {
                          const { isWide } = useTableLayout();
                          return (
                            <td
                              {...props}
                              className={
                                isWide
                                  ? "whitespace-nowrap border border-white/10 px-3 py-2 align-top"
                                  : "whitespace-normal break-words border border-white/10 px-3 py-2 align-top"
                              }
                            />
                          );
                        },

                        code: (p: any) => {
                          const { inline, className, children, ...props } = p as any;

                          const text = String(children ?? "");
                          const match = /language-(\w+)/.exec(className ?? "");
                          const lang = match?.[1]?.toLowerCase();

                          const disguisedCsv =
                            !inline && (!lang || lang === "text") && looksLikeCsvText(text);

                          // ✅ CSV explícito: não renderiza (evita duplicar)
                          if (!inline && lang === "csv") return null;

                          // ✅ CSV “disfarçado”: renderiza como tabela preview + botões
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

                        // ✅ CORREÇÃO DO “FANTASMA”:
                        // - não renderiza <pre> vazio
                        // - e não envolve componentes custom dentro de <pre>
                        pre: ({ node, children, ...props }) => {
                          const arr = Children.toArray(children);

                          if (arr.length === 0) return null;

                          // Se for um componente React custom (ex: CsvBlockWithDownloads),
                          // não deve ficar dentro de <pre>.
                          if (arr.length === 1 && isValidElement(arr[0])) {
                            const el: any = arr[0];
                            if (typeof el.type !== "string") {
                              return <>{children}</>;
                            }
                          }

                          // Pre vazio? some com ele.
                          const txt = extractText(children);
                          if (!txt.trim()) return null;

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
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {(onCopyAnswer || onShareConversation || onRegenerateLast) && (
                  <div className="mt-2 flex flex-col gap-2 text-xs">
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

      <div ref={bottomRef} />
    </div>
  );
}
