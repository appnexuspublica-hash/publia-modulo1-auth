"use client";

import { useEffect, useMemo, useRef } from "react";
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

// ----------------------------------------------------
// Helpers: CSV / Downloads
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

function toCsvFromMatrix(data: string[][], delimiter = ";") {
  const esc = (v: string) => {
    const s = (v ?? "").toString();
    if (s.includes('"') || s.includes("\n") || s.includes(delimiter)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return data.map((row) => row.map(esc).join(delimiter)).join("\n");
}

// Parser simples de CSV com aspas (para manter fidelidade do bloco ```csv```)
// Suporta delimitador ; ou , (auto)
function parseCsv(csvTextRaw: string): { delimiter: string; rows: string[][] } {
  const csvText = csvTextRaw.replace(/\r\n/g, "\n").trim();
  const delimiter = csvText.includes(";") ? ";" : ",";

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

function sanitizeFilenameBase(name: string) {
  return (name || "planilha")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ✅ Excel agora é gerado no BACKEND (Node) e baixado como blob
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

function tableElementToMatrix(tableEl: HTMLTableElement): string[][] {
  const trs = Array.from(tableEl.querySelectorAll("tr"));
  return trs.map((tr) =>
    Array.from(tr.querySelectorAll("th,td")).map((cell) =>
      (cell.textContent ?? "").trim()
    )
  );
}

// ----------------------------------------------------
// UI: Downloads abaixo de CADA tabela
// ----------------------------------------------------
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

  return (
    <div className="my-3 w-full rounded-xl border border-white/10">
      <div className="w-full overflow-x-auto">
        <table
          {...tableProps}
          ref={tableRef}
          className="w-full border-collapse text-[13px]"
        >
          {children}
        </table>
      </div>

      {/* ✅ Sem “Tabela X:” — só botões e alinhado à esquerda */}
      <div className="flex flex-wrap items-center justify-start gap-2 px-3 py-2 text-[11px] text-slate-100/90">
              <button
          type="button"
          onClick={() => {
            const el = tableRef.current;
            if (!el) return;
            const matrix = tableElementToMatrix(el);
            const csv = toCsvFromMatrix(matrix, ";");
            downloadTextFile(
              `tabela-${index}.csv`,
              csv,
              "text/csv;charset=utf-8"
            );
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
  );
}

// ----------------------------------------------------
// UI: Downloads abaixo de CADA bloco ```csv``` (100% fiel)
// ----------------------------------------------------
function CsvBlockWithDownloads({
  index,
  csvText,
}: {
  index: number;
  csvText: string;
}) {
  const { rows } = useMemo(() => parseCsv(csvText), [csvText]);
  const baseName = sanitizeFilenameBase(`planilha-${index}`);

  return (
    <div className="my-3 w-full rounded-xl border border-white/10">
      <pre className="overflow-x-auto rounded-xl bg-black/20 p-3 text-[12px] leading-relaxed">
        <code>{csvText}</code>
      </pre>

      {/* ✅ Sem “CSV X:” — só botões e alinhado à esquerda */}
     <div className="flex flex-wrap items-center justify-start gap-2 px-3 py-2 text-[11px] text-slate-100/90">
        <button
          type="button"
          onClick={() =>
            downloadTextFile(
              `${baseName}.csv`,
              csvText.trim(),
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
  const lastUser = [...messages]
    .slice()
    .reverse()
    .find((m) => m.role === "user");

  const userMessages = messages.filter((m) => m.role === "user");
  const lastTwoUsers = userMessages.slice(-2);
  const isRegeneratedForSameQuestion =
    lastTwoUsers.length === 2 &&
    lastTwoUsers[0].content.trim() === lastTwoUsers[1].content.trim();

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

        if (showDateDivider) lastDateLabel = dateLabel!;

        let tableIndex = 0;
        let csvIndex = 0;

        return (
          <div key={msg.id}>
            {showDateDivider && (
              <div className="my-4 text-[11px] font-semibold text-slate-300">
                {dateLabel}
              </div>
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

                        // ✅ Tabela: quebra linha nas células + downloads embaixo
                        table: ({ node, ...props }) => {
                          tableIndex += 1;
                          return (
                            <TableWithDownloads
                              index={tableIndex}
                              tableProps={props}
                            >
                              {props.children}
                            </TableWithDownloads>
                          );
                        },
                        thead: ({ node, ...props }) => (
                          <thead {...props} className="bg-white/5" />
                        ),
                        th: ({ node, ...props }) => (
                          <th
                            {...props}
                            className="whitespace-normal break-words border border-white/15 px-3 py-2 text-left font-semibold"
                          />
                        ),
                        td: ({ node, ...props }) => (
                          <td
                            {...props}
                            className="whitespace-normal break-words border border-white/10 px-3 py-2 align-top"
                          />
                        ),

                        // ✅ Bloco ```csv``` do modelo: downloads 100% fiéis
                        code: (p: any) => {
                          const { inline, className, children, ...props } =
                            p as any;

                          const text = String(children ?? "");
                          const match = /language-(\w+)/.exec(className ?? "");
                          const lang = match?.[1]?.toLowerCase();

                          if (!inline && lang === "csv") {
                            csvIndex += 1;
                            return (
                              <CsvBlockWithDownloads
                                index={csvIndex}
                                csvText={text}
                              />
                            );
                          }

                          return (
                            <code {...props} className="text-[12px]">
                              {children}
                            </code>
                          );
                        },

                        pre: ({ node, ...props }) => (
                          <pre
                            {...props}
                            className="my-3 overflow-x-auto rounded-xl bg-black/20 p-3"
                          />
                        ),
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
