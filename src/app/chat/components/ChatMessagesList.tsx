//src/app/chat/components/ChatMessagesList.tsx
"use client";

import {
  useEffect,
  useRef,
  useState,
  isValidElement,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from "react";
import type { RefObject, CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAlertStyles, type AlertTone } from "../utils/alertStyles";
import { getChatTheme } from "@/app/chat/theme";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

export type SuggestedNextQuestion = {
  id: string;
  label: string;
  prompt: string;
};

type Variant = "chat" | "share";

type ActionToast = {
  messageId: string;
  text: string;
  tone?: AlertTone;
} | null;

type BlockedCta = {
  href: string;
  label: string;
} | null;

type ChatMessagesListProps = {
  messages: ChatMessage[];
  onCopyAnswer?: (messageId: string) => void | Promise<void>;
  onShareConversation?: (
    conversationId: string,
    messageId: string
  ) => void | Promise<void>;
  onRegenerateLast?: (lastUserMessage: string) => void | Promise<void>;
  onDoOcr?: () => void | Promise<void>;
  onSuggestionClick?: (prompt: string) => void | Promise<void>;
  onFillInputSuggestion?: (prompt: string) => void;
  suggestions?: SuggestedNextQuestion[];
  isSending: boolean;
  activePdfName?: string | null;
  variant?: Variant;
  activeConversationId?: string | null;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  actionToast?: ActionToast;
  isBlocked?: boolean;
  blockedMessage?: string;
  blockedCta?: BlockedCta;
  productTier?: "essential" | "strategic" | "governance" | string | null;
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

async function readErrorMessage(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const data: any = await res.json();
      const msg =
        (typeof data === "string" && data) ||
        data?.message ||
        data?.error ||
        data?.detail ||
        data?.msg;
      if (typeof msg === "string" && msg.trim()) return msg.trim();
      return JSON.stringify(data);
    }

    const txt = await res.text();
    return (txt || "").trim();
  } catch {
    return "";
  }
}

function isSessionExpiredStatus(status: number) {
  return status === 401 || status === 403 || status === 419 || status === 440;
}

async function downloadXlsxFromRows(rows: string[][], filename: string) {
  const res = await fetch("/api/export-xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, rows }),
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const msg = await readErrorMessage(res);

    if (isSessionExpiredStatus(res.status) || /sess[aã]o\s+expirad/i.test(msg)) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:session-expired"));
      }
      throw new Error(
        "Sessão expirada. Faça login novamente e tente baixar de novo."
      );
    }

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
  tableOuterBorder: "w-full border border-slate-300",
  tableClassWide: "min-w-max w-full border-collapse text-[13px]",
  tableClassNormal: "w-full table-auto border-collapse text-[13px]",
  theadBg: "bg-slate-200/60",
  thWide:
    "whitespace-nowrap border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800",
  thNormal:
    "whitespace-normal break-words border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800",
  tdWide:
    "whitespace-nowrap border border-slate-300 px-3 py-2 align-top text-slate-800",
  tdNormal:
    "whitespace-normal break-words border border-slate-300 px-3 py-2 align-top text-slate-800",
  btn: "rounded-full border border-slate-400 px-3 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-200",
  pre: "my-3 overflow-x-auto rounded-xl bg-slate-200/70 p-3 text-slate-800",
  link: "text-inherit underline underline-offset-2 hover:opacity-80",
};

const THEME_SHARE: MdTheme = {
  tableOuterBorder: "w-full border border-slate-200/20",
  tableClassWide: "min-w-max w-full border-collapse text-[13px]",
  tableClassNormal: "w-full table-auto border-collapse text-[13px]",
  theadBg: "bg-slate-200/10",
  thWide:
    "whitespace-nowrap border border-slate-200/25 px-3 py-2 text-left font-semibold",
  thNormal:
    "whitespace-normal break-words border border-slate-200/25 px-3 py-2 text-left font-semibold",
  tdWide: "whitespace-nowrap border border-slate-200/15 px-3 py-2 align-top",
  tdNormal:
    "whitespace-normal break-words border border-slate-200/15 px-3 py-2 align-top",
  btn: "rounded-full border border-slate-200/50 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10",
  pre: "my-3 overflow-x-auto rounded-xl bg-black/25 p-3",
  link: "text-inherit underline underline-offset-2 hover:opacity-80",
};

const THEME_CHAT_STRATEGIC: MdTheme = {
  tableOuterBorder: "w-full border border-white/20",
  tableClassWide: "min-w-max w-full border-collapse text-[13px] text-white",
  tableClassNormal: "w-full table-auto border-collapse text-[13px] text-white",
  theadBg: "bg-white/10",
  thWide:
    "whitespace-nowrap border border-white/20 px-3 py-2 text-left font-semibold text-white",
  thNormal:
    "whitespace-normal break-words border border-white/20 px-3 py-2 text-left font-semibold text-white",
  tdWide:
    "whitespace-nowrap border border-white/15 px-3 py-2 align-top text-white",
  tdNormal:
    "whitespace-normal break-words border border-white/15 px-3 py-2 align-top text-white",
  btn: "rounded-full border border-white/40 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-white/10",
  pre: "my-3 overflow-x-auto rounded-xl bg-black/20 p-3 text-white",
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
    Array.from(tr.querySelectorAll("th,td")).map((cell) =>
      (cell.textContent ?? "").trim()
    )
  );
}

function normalizeBareLinksInText(input: string) {
  if (!input) return "";

  const parts = input.split(
    /(```[\s\S]*?```|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g
  );

  const processed = parts.map((part) => {
    if (!part) return part;

    const isProtectedBlock =
      (part.startsWith("```") && part.endsWith("```")) ||
      (part.startsWith("`") && part.endsWith("`")) ||
      /^\[[^\]]+\]\([^)]+\)$/.test(part);

    if (isProtectedBlock) {
      return part;
    }

    let text = part;

    text = text.replace(
      /(^|[\s(>])((?:https?:\/\/)[^\s<]+)/gi,
      (match, prefix: string, url: string) => {
        const cleaned = url.replace(/[),.;:!?]+$/, "");
        const trailing = url.slice(cleaned.length);

        return `${prefix}[${cleaned}](${cleaned})${trailing}`;
      }
    );

    text = text.replace(
      /(^|[\s(>])((?:www\.)[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<]*)?)/gi,
      (match, prefix: string, domain: string) => {
        const cleaned = domain.replace(/[),.;:!?]+$/, "");
        const trailing = domain.slice(cleaned.length);

        return `${prefix}[${cleaned}](https://${cleaned})${trailing}`;
      }
    );

    text = text.replace(
      /(^|[\s(>])((?!https?:\/\/)(?!www\.)(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<]*)?)/gi,
      (match, prefix: string, domain: string) => {
        const cleaned = domain.replace(/[),.;:!?]+$/, "");
        const trailing = domain.slice(cleaned.length);

        const lower = cleaned.toLowerCase();

        if (
          lower.startsWith("mailto:") ||
          lower.includes("@") ||
          lower.startsWith("localhost") ||
          lower.startsWith("127.0.0.1")
        ) {
          return match;
        }

        return `${prefix}[${cleaned}](https://${cleaned})${trailing}`;
      }
    );

    return text;
  });

  return processed.join("");
}

function getInlineAlertStyles(
  variant: Variant,
  productTier: ChatMessagesListProps["productTier"],
  tone: AlertTone = "success"
) {
  const isStrategicUi = variant === "share" || productTier === "strategic";

  return getAlertStyles(tone, isStrategicUi);
}

function extractInputSuggestion(markdown: string): {
  contentWithoutSuggestion: string;
  suggestionText: string | null;
} {
  const normalized = String(markdown ?? "").trim();
  if (!normalized) {
    return {
      contentWithoutSuggestion: "",
      suggestionText: null,
    };
  }

  const introPattern =
    /(?:^|\n)((?:se\s+(?:voc[eê]\s+)?(?:quiser|desejar)|caso\s+queira|se\s+preferir|posso\s+tamb[eé]m|posso[^\n]*se\s+(?:voc[eê]\s+)?quiser)[^\n]*)/i;

  const introMatch = normalized.match(introPattern);

  if (!introMatch || introMatch.index === undefined) {
    return {
      contentWithoutSuggestion: normalized,
      suggestionText: null,
    };
  }

  const introText = introMatch[1]?.trim();
  if (!introText) {
    return {
      contentWithoutSuggestion: normalized,
      suggestionText: null,
    };
  }

  const start = introMatch.index + (introMatch[0].startsWith("\n") ? 1 : 0);
  const afterIntroStart = start + introMatch[0].trimStart().length;
  const rest = normalized.slice(afterIntroStart);

  const listMatch = rest.match(
    /^(\s*\n(?:\s*[-*•]\s+[^\n]+|\s*\d+[.)]\s+[^\n]+))+/
  );

  const suggestionBlock = (
    introText + (listMatch ? listMatch[0] : "")
  ).trim();

  const end = afterIntroStart + (listMatch ? listMatch[0].length : 0);

  let contentWithoutSuggestion = normalized.slice(0, start) + normalized.slice(end);

  contentWithoutSuggestion = contentWithoutSuggestion
    .replace(/(^|\n)\s*([-*_])\2{2,}\s*(?=\n|$)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\s+\n/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return {
    contentWithoutSuggestion,
    suggestionText: suggestionBlock,
  };
}

function addSeparatorBeforeBaseLegal(markdown: string, enabled: boolean) {
  if (!enabled) return markdown;

  return markdown.replace(
    /(^|\n)(?:\*\*\s*)?Base legal:(?:\s*\*\*)?\s*/i,
    (match, prefix) => `${prefix}---\n\nBase legal:\n`
  );
}

function TableWithDownloads({
  index,
  children,
  tableProps,
  enableDownloads = true,
}: {
  index: number;
  children: React.ReactNode;
  tableProps: React.TableHTMLAttributes<HTMLTableElement>;
  enableDownloads?: boolean;
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

        {enableDownloads && (
          <div className="mt-2 flex flex-wrap items-center justify-start gap-2 text-[11px] text-slate-700">
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
        )}
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
    const isCandidate =
      overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
    if (isCandidate) return p;
    p = p.parentElement;
  }

  return (document.scrollingElement as HTMLElement | null) ?? null;
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

function splitMarkdownFooter(md: string): { main: string; footer: string } {
  const s = String(md ?? "");
  const re =
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:(?:\*\*|__)\s*)?base\s+legal\s*(?:(?:\*\*|__)\s*)?:?\s*(?:\n|$)/i;

  const m = re.exec(s);
  if (!m) return { main: s, footer: "" };

  const start = m.index;
  const main = s.slice(0, start).trimEnd();
  const footer = s.slice(start).trim();
  return { main, footer };
}

function ThCell(props: any) {
  const theme = useMdTheme();
  const { isWide } = useTableLayout();
  return <th {...props} className={isWide ? theme.thWide : theme.thNormal} />;
}

function TdCell(props: any) {
  const theme = useMdTheme();
  const { isWide } = useTableLayout();
  return <td {...props} className={isWide ? theme.tdWide : theme.tdNormal} />;
}

export function ChatMessagesList({
  messages,
  onCopyAnswer,
  onShareConversation,
  onRegenerateLast,
  onDoOcr,
  onSuggestionClick,
  onFillInputSuggestion,
  suggestions = [],
  isSending,
  variant = "chat",
  scrollContainerRef,
  activeConversationId,
  actionToast = null,
  isBlocked = false,
  blockedMessage = "",
  blockedCta = null,
  productTier = null,
}: ChatMessagesListProps) {
  const normalizedProductTier =
    typeof productTier === "string" ? productTier.trim().toLowerCase() : "";
  const isStrategic = normalizedProductTier.includes("strategic");
  const theme = variant === "share" ? THEME_SHARE : isStrategic ? THEME_CHAT_STRATEGIC : THEME_CHAT;

  const enableTableDownloads = variant === "chat";

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unread, setUnread] = useState(0);

  const isAtBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  const chatTheme = useMemo(() => getChatTheme(isStrategic), [isStrategic]);

  const lastAssistant = [...messages].slice().reverse().find((m) => m.role === "assistant");
  const lastUser = [...messages].slice().reverse().find((m) => m.role === "user");

  const userMessages = messages.filter((m) => m.role === "user");
  const lastTwoUsers = userMessages.slice(-2);
  const isRegeneratedForSameQuestion =
    lastTwoUsers.length === 2 &&
    lastTwoUsers[0].content.trim() === lastTwoUsers[1].content.trim();

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

  const canShare =
    variant === "chat" &&
    typeof activeConversationId === "string" &&
    activeConversationId.trim().length > 0 &&
    typeof onShareConversation === "function";

  const showOcrButton =
    typeof onDoOcr === "function" &&
    !!lastAssistant &&
    !!lastUser &&
    !isSending &&
    String(lastAssistant.content ?? "").toLowerCase().includes("faça ocr");

  const showStrategicSuggestions =
    variant === "chat" &&
    productTier === "strategic" &&
    Array.isArray(suggestions) &&
    suggestions.length > 0 &&
    typeof onSuggestionClick === "function";

  const strategicActionButtonClass =
    "rounded-full border px-3 py-1 text-[11px] font-medium transition duration-150 hover:brightness-110";

  return (
    <MarkdownThemeContext.Provider value={theme}>
      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isLastAssistant = !!lastAssistant && msg.id === lastAssistant.id;
          const isGeneratingThis = isLastAssistant && isSending;
          const regenerateBlocked = isGeneratingThis || isBlocked;
          const ocrBlocked = isGeneratingThis || isBlocked;
          const suggestionBlocked = isGeneratingThis || isBlocked || isSending;
          const inlineSuggestionBlocked = isGeneratingThis || isBlocked || isSending;

          let tableIndex = 0;

          const userBubble =
            variant === "share"
              ? "bg-[#0d4161] text-white"
              : isStrategic
                ? ""
                : "bg-[#8e8e8e] text-white";

          const assistantBubble =
            variant === "share"
              ? "bg-[#274d69] text-slate-50"
              : isStrategic
                ? ""
                : "bg-[#e5e5e5] text-slate-800";

          const assistantMetaTextClass =
            variant === "share"
              ? "text-slate-100/90"
              : isStrategic
                ? ""
                : "text-slate-700";

          const actionToastStyles = getInlineAlertStyles(
            variant,
            productTier,
            actionToast?.tone ?? "success"
          );

          const actionButtonClass =
            isStrategic && variant === "chat" ? strategicActionButtonClass : theme.btn;

          const { main, footer } = splitMarkdownFooter(msg.content);

          const {
            contentWithoutSuggestion,
            suggestionText,
          } = isStrategic && msg.role === "assistant"
            ? extractInputSuggestion(main)
            : { contentWithoutSuggestion: main, suggestionText: null };

          const mainPrepared = addSeparatorBeforeBaseLegal(contentWithoutSuggestion, isStrategic);
          const mainWithLinks = normalizeBareLinksInText(mainPrepared);
          const footerWithLinks = normalizeBareLinksInText(footer);

          const markdownComponentsMain: any = {
            a: ({ node, ...props }: any) => (
              <a
                {...props}
                target="_blank"
                rel="noreferrer noopener"
                className={theme.link}
              />
            ),
            hr: () => (
              <div
                className={
                  variant === "share"
                    ? "my-4 h-px w-full bg-white/20"
                    : isStrategic
                      ? "my-4 h-px w-full"
                      : "my-4 h-px w-full bg-slate-400/50"
                }
                style={
                  variant === "chat" && isStrategic
                    ? { backgroundColor: chatTheme.colors.borderStrong }
                    : undefined
                }
              />
            ),

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
                <TableWithDownloads
                  index={tableIndex}
                  tableProps={props}
                  enableDownloads={enableTableDownloads}
                >
                  {props.children}
                </TableWithDownloads>
              );
            },
            thead: ({ node, ...props }: any) => (
              <thead {...props} className={theme.theadBg} />
            ),
            th: (props: any) => <ThCell {...props} />,
            td: (props: any) => <TdCell {...props} />,

            code: (p: any) => {
              const { inline, className, children, ...props } = p as any;
              const text = String(children ?? "");
              const match = /language-(\w+)/.exec(className ?? "");
              const lang = match?.[1]?.toLowerCase();

              if (!inline && lang === "csv") return null;

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
              <a
                {...props}
                target="_blank"
                rel="noreferrer noopener"
                className={theme.link}
              />
            ),

            table: () => null,
            pre: () => null,
            code: () => null,

            h1: ({ node, ...props }: any) => {
              const txt = extractText((props as any).children);
              if (isCsvHeading(txt)) return null;
              return (
                <p className="publia-footnote__heading">
                  {(props as any).children}
                </p>
              );
            },
            h2: ({ node, ...props }: any) => {
              const txt = extractText((props as any).children);
              if (isCsvHeading(txt)) return null;
              return (
                <p className="publia-footnote__heading">
                  {(props as any).children}
                </p>
              );
            },
            h3: ({ node, ...props }: any) => {
              const txt = extractText((props as any).children);
              if (isCsvHeading(txt)) return null;
              return (
                <p className="publia-footnote__heading">
                  {(props as any).children}
                </p>
              );
            },
            p: ({ node, ...props }: any) => {
              const txt = extractText((props as any).children);
              if (!txt.trim()) return null;
              if (isCsvHeading(txt)) return null;
              return <p {...props} />;
            },

            ul: ({ node, ...props }: any) => (
              <ul {...props} className="mt-2 list-none space-y-1 p-0" />
            ),
            ol: ({ node, ...props }: any) => (
              <ol {...props} className="mt-2 list-none space-y-1 p-0" />
            ),
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
                  {getUserDateTimeLabel(msg.created_at) && (
                    <div
                      className={`mb-2 text-[11px] font-semibold ${
                        isStrategic ? "" : "text-slate-700"
                      }`}
                      style={
                        isStrategic
                          ? { color: chatTheme.colors.text }
                          : undefined
                      }
                    >
                      {getUserDateTimeLabel(msg.created_at)}
                    </div>
                  )}

                  <div
                    className={"inline-block max-w-[80%] rounded-xl px-5 py-2 " + userBubble}
                    style={
                      variant === "chat" && isStrategic
                        ? {
                            backgroundColor: chatTheme.colors.bubbleUser,
                            color: chatTheme.colors.text,
                          }
                        : undefined
                    }
                  >
                    <p className="whitespace-pre-line text-[14px] leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-start">
                  <div
                    className={"w-full rounded-3xl px-6 py-4 " + assistantBubble}
                    style={
                      variant === "chat" && isStrategic
                        ? {
                            backgroundColor: chatTheme.colors.bg,
                            color: chatTheme.colors.text,
                          }
                        : undefined
                    }
                  >
                    {onRegenerateLast &&
                      lastAssistant &&
                      msg.id === lastAssistant.id &&
                      isRegeneratedForSameQuestion && (
                        <div
                          className={
                            "mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] " +
                            assistantMetaTextClass
                          }
                          style={
                            variant === "chat" && isStrategic
                              ? { color: chatTheme.colors.textMuted }
                              : undefined
                          }
                        >
                          Resposta regenerada
                        </div>
                      )}

                    <div className="markdown text-[14px] leading-relaxed" data-copy-id={msg.id}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponentsMain}
                      >
                        {mainWithLinks}
                      </ReactMarkdown>
                    </div>

                    {isStrategic &&
                      suggestionText &&
                      typeof onFillInputSuggestion === "function" && (
                        <div className="mt-4">
                          <button
                            type="button"
                            disabled={inlineSuggestionBlocked}
                            onClick={() => {
                              if (inlineSuggestionBlocked) return;
                              onFillInputSuggestion(suggestionText);
                            }}
                            className={
                              "w-full rounded-2xl border px-4 py-3 text-left text-[14px] leading-relaxed transition " +
                              (inlineSuggestionBlocked
                                ? "cursor-not-allowed opacity-50"
                                : "")
                            }
                            style={{
                              borderColor: chatTheme.colors.borderStrong,
                              backgroundColor: chatTheme.colors.hover,
                              color: chatTheme.colors.text,
                            }}
                            onMouseEnter={(e) => {
                              if (inlineSuggestionBlocked) return;
                              e.currentTarget.style.backgroundColor =
                                chatTheme.colors.buttonGhostHover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                chatTheme.colors.hover;
                            }}
                            title={isBlocked ? blockedMessage : "Preencher no input"}
                          >
                            {suggestionText}
                          </button>
                        </div>
                      )}

                    {footer.trim().length > 0 && (
                      <div
                        className={"publia-footnote mt-4 " + assistantMetaTextClass}
                        data-footnote
                        style={
                          variant === "chat" && isStrategic
                            ? { color: chatTheme.colors.textMuted }
                            : undefined
                        }
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponentsFooter}
                        >
                          {footerWithLinks}
                        </ReactMarkdown>
                      </div>
                    )}

                    {isGeneratingThis && (
                      <div
                        className={
                          "mt-3 flex items-center gap-2 text-xs " + assistantMetaTextClass
                        }
                        style={
                          variant === "chat" && isStrategic
                            ? { color: chatTheme.colors.textMuted }
                            : undefined
                        }
                      >
                        <span
                          className={
                            variant === "share"
                              ? "inline-block h-2 w-2 animate-pulse rounded-full bg-slate-100"
                              : isStrategic
                                ? "inline-block h-2 w-2 animate-pulse rounded-full"
                                : "inline-block h-2 w-2 animate-pulse rounded-full bg-slate-700"
                          }
                          style={
                            variant === "chat" && isStrategic
                              ? { backgroundColor: chatTheme.colors.text }
                              : undefined
                          }
                        />
                        <span>Gerando resposta...</span>
                      </div>
                    )}
                  </div>

                  {(onCopyAnswer || onRegenerateLast || canShare || showOcrButton) && (
                    <div className="mt-2 flex w-full flex-col gap-2 text-xs">
                      {actionToast?.messageId === msg.id && (
                        <div className={actionToastStyles.container}>
                          {actionToast.text}
                        </div>
                      )}

                      {isBlocked &&
                        blockedMessage &&
                        lastAssistant &&
                        msg.id === lastAssistant.id &&
                        (onRegenerateLast || showOcrButton) && (
                          <div
                            className={
                              isStrategic || variant === "share"
                                ? "w-full rounded-lg border px-3 py-2 text-xs leading-snug"
                                : "w-full rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs leading-snug text-amber-950"
                            }
                            style={
                              variant === "chat" && isStrategic
                                ? {
                                    borderColor: chatTheme.colors.borderStrong,
                                    backgroundColor: chatTheme.colors.hover,
                                    color: chatTheme.colors.text,
                                  }
                                : undefined
                            }
                          >
                            <div className="font-medium">
                              Acesso bloqueado para novas ações
                            </div>

                            <div className="mt-1">{blockedMessage}</div>

                            {blockedCta && (
                              <div className="mt-2">
                                <a
                                  href={blockedCta.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={
                                    isStrategic || variant === "share"
                                      ? "inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold transition duration-150 hover:brightness-110"
                                      : "inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
                                  }
                                  style={
                                    variant === "chat" && isStrategic
                                      ? {
                                          borderColor: chatTheme.colors.borderStrong,
                                          backgroundColor: chatTheme.colors.buttonGhostHover,
                                          color: chatTheme.colors.text,
                                        }
                                      : undefined
                                  }
                                >
                                  {blockedCta.label}
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {onCopyAnswer && (
                          <button
                            type="button"
                            disabled={isGeneratingThis}
                            onClick={() => onCopyAnswer(msg.id)}
                            className={
                              actionButtonClass +
                              (isGeneratingThis ? " cursor-not-allowed opacity-50" : "")
                            }
                            style={
                              isStrategic && variant === "chat"
                                ? {
                                    borderColor: chatTheme.colors.borderStrong,
                                    backgroundColor: chatTheme.colors.bg,
                                    color: chatTheme.colors.text,
                                  }
                                : undefined
                            }
                          >
                            Copiar
                          </button>
                        )}

                        {canShare && (
                          <button
                            type="button"
                            disabled={isGeneratingThis}
                            onClick={() =>
                              onShareConversation!(activeConversationId!.trim(), msg.id)
                            }
                            className={
                              actionButtonClass +
                              (isGeneratingThis ? " cursor-not-allowed opacity-50" : "")
                            }
                            style={
                              isStrategic && variant === "chat"
                                ? {
                                    borderColor: chatTheme.colors.borderStrong,
                                    backgroundColor: chatTheme.colors.bg,
                                    color: chatTheme.colors.text,
                                  }
                                : undefined
                            }
                          >
                            Compartilhar
                          </button>
                        )}

                        {onRegenerateLast &&
                          lastAssistant &&
                          lastUser &&
                          msg.id === lastAssistant.id && (
                            <button
                              type="button"
                              disabled={regenerateBlocked}
                              onClick={() => {
                                if (regenerateBlocked) return;
                                void onRegenerateLast(lastUser.content);
                              }}
                              title={isBlocked ? blockedMessage : "Regenerar resposta"}
                              className={
                                actionButtonClass +
                                (regenerateBlocked ? " cursor-not-allowed opacity-50" : "")
                              }
                              style={
                                isStrategic && variant === "chat"
                                  ? {
                                      borderColor: chatTheme.colors.borderStrong,
                                      backgroundColor: chatTheme.colors.bg,
                                      color: chatTheme.colors.text,
                                    }
                                  : undefined
                              }
                            >
                              Regenerar
                            </button>
                          )}

                        {showOcrButton &&
                          onDoOcr &&
                          lastAssistant &&
                          msg.id === lastAssistant.id && (
                            <button
                              type="button"
                              disabled={ocrBlocked}
                              onClick={() => {
                                if (ocrBlocked) return;
                                void onDoOcr();
                              }}
                              title={isBlocked ? blockedMessage : "Fazer OCR"}
                              className={
                                actionButtonClass +
                                (ocrBlocked ? " cursor-not-allowed opacity-50" : "")
                              }
                              style={
                                isStrategic && variant === "chat"
                                  ? {
                                      borderColor: chatTheme.colors.borderStrong,
                                      backgroundColor: chatTheme.colors.bg,
                                      color: chatTheme.colors.text,
                                    }
                                  : undefined
                              }
                            >
                              Fazer OCR
                            </button>
                          )}
                      </div>
                    </div>
                  )}

                  {showStrategicSuggestions &&
                    lastAssistant &&
                    msg.id === lastAssistant.id && (
                      <div
                        className={
                          isStrategic
                            ? "mt-4 flex w-full flex-col items-center justify-center px-2 py-2 text-center"
                            : "mt-3 w-full rounded-2xl border border-slate-300 bg-[#dcdcdc] px-4 py-3"
                        }
                        style={
                          isStrategic
                            ? {
                                backgroundColor: chatTheme.colors.bg,
                              }
                            : undefined
                        }
                      >
                        <div
                          className={
                            isStrategic
                              ? "mb-3 text-[11px] font-semibold uppercase tracking-[0.14em]"
                              : "mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700"
                          }
                          style={
                            isStrategic
                              ? { color: chatTheme.colors.textMuted }
                              : undefined
                          }
                        >
                          Sugestões de próxima pergunta
                        </div>

                        <div
                          className={
                            isStrategic
                              ? "flex w-full flex-wrap items-center justify-center gap-2"
                              : "flex flex-wrap gap-2"
                          }
                        >
                          {suggestions.map((suggestion) => {
                            return (
                              <button
                                key={suggestion.id}
                                type="button"
                                disabled={suggestionBlocked}
                                onClick={() => {
                                  if (suggestionBlocked) return;
                                  void onSuggestionClick?.(suggestion.prompt);
                                }}
                                title={isBlocked ? blockedMessage : suggestion.label}
                                className={
                                  isStrategic
                                    ? "rounded-full border px-3 py-2 text-center text-[12px] leading-snug transition " +
                                      (suggestionBlocked ? "cursor-not-allowed opacity-50" : "")
                                    : "rounded-full border border-slate-300 bg-slate-100 px-3 py-2 text-center text-[12px] leading-snug text-slate-800 transition hover:bg-slate-200 " +
                                      (suggestionBlocked ? "cursor-not-allowed opacity-50" : "")
                                }
                                style={
                                  isStrategic
                                    ? {
                                        borderColor: chatTheme.colors.border,
                                        backgroundColor: chatTheme.colors.hover,
                                        color: chatTheme.colors.text,
                                      }
                                    : undefined
                                }
                                onMouseEnter={(e) => {
                                  if (!isStrategic || suggestionBlocked) return;
                                  e.currentTarget.style.backgroundColor =
                                    chatTheme.colors.buttonGhostHover;
                                }}
                                onMouseLeave={(e) => {
                                  if (!isStrategic) return;
                                  e.currentTarget.style.backgroundColor =
                                    chatTheme.colors.hover;
                                }}
                              >
                                {suggestion.label}
                              </button>
                            );
                          })}
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

        {isStrategic && (
          <style jsx>{`
            .publia-strategic-suggestion-btn {
              background-color: var(--suggestion-bg);
            }

            .publia-strategic-suggestion-btn:hover {
              background-color: var(--suggestion-hover-bg);
            }
          `}</style>
        )}
      </div>
    </MarkdownThemeContext.Provider>
  );
}