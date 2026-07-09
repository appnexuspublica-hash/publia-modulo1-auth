// src/app/governanca/share/[shareId]/page.tsx
import Image from "next/image";
import { Children, isValidElement } from "react";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageSearchParams = {
  messageId?: string | string[];
};

type PageProps = {
  params: {
    shareId: string;
  };
  searchParams?: PageSearchParams | Promise<PageSearchParams>;
};

type SharedConversation = {
  id: string;
  title: string | null;
  organization_id: string | null;
  created_at: string | null;
  is_shared: boolean;
  share_id: string | null;
};

type SharedMessage = {
  id: string;
  conversation_id: string | null;
  role: string;
  content: string;
  created_at: string | null;
};

type CsvDownload = {
  filename: string;
  csv: string;
  label: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatDate(value?: string | null) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function createPublicSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente.");

  const key = serviceRoleKey || anonKey;

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausente.",
    );
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeCsvText(csv: string) {
  return String(csv ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function looksLikeCsv(text: string) {
  const cleaned = normalizeCsvText(text);
  const lines = cleaned.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length < 2) return false;

  const sample = lines.slice(0, 8).join("\n");
  const semicolons = (sample.match(/;/g) ?? []).length;
  const tabs = (sample.match(/\t/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;

  return semicolons >= 2 || tabs >= 2 || commas >= 4;
}

function extractTextFromNode(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromNode).join("");
  if (typeof node === "object" && "props" in node) {
    return extractTextFromNode((node as any).props?.children);
  }
  return "";
}

function isCsvHeading(text: string) {
  const normalized = String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[:：]+$/g, "");

  return (
    normalized === "versao em csv" ||
    normalized === "csv" ||
    normalized === "planilha em csv" ||
    normalized === "tabela em csv"
  );
}

function extractCsvDownloads(content: string, fallbackId = "tabela") {
  const source = String(content ?? "");
  const downloads: CsvDownload[] = [];
  const seen = new Set<string>();

  function addCsv(rawCsv: string, index: number) {
    const csv = normalizeCsvText(rawCsv)
      .replace(/^```(?:csv|tsv)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    if (!looksLikeCsv(csv)) return;

    const key = csv.replace(/\s+/g, " ");
    if (seen.has(key)) return;

    seen.add(key);
    downloads.push({
      filename: `publia-governanca-${fallbackId}-tabela-${index + 1}.csv`,
      csv,
      label:
        downloads.length > 0
          ? `Baixar tabela/planilha ${downloads.length + 1}`
          : "Baixar tabela/planilha",
    });
  }

  const fencedRegex = /```(?:csv|tsv)\s*\n([\s\S]*?)```/gi;
  let fencedMatch: RegExpExecArray | null;

  while ((fencedMatch = fencedRegex.exec(source)) !== null) {
    addCsv(fencedMatch[1] ?? "", downloads.length);
  }

  const headingBlockRegex =
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:vers[aã]o\s+em\s+csv|csv|planilha\s+em\s+csv|tabela\s+em\s+csv)\s*:?[ \t]*\n([\s\S]*?)(?=\n\s*(?:#{1,6}\s+|Base\s+legal\b|Refer[eê]ncias\s+oficiais\s+consultadas\b|$))/gi;

  let headingMatch: RegExpExecArray | null;

  while ((headingMatch = headingBlockRegex.exec(source)) !== null) {
    const rawBlock = String(headingMatch[1] ?? "").trim();
    const fencedInside = rawBlock.match(/^```(?:csv|tsv)?\s*\n([\s\S]*?)```$/i);

    addCsv(fencedInside?.[1] ?? rawBlock, downloads.length);
  }

  return downloads;
}

function stripCsvSections(content: string) {
  let output = String(content ?? "");

  output = output.replace(
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:vers[aã]o\s+em\s+csv|csv|planilha\s+em\s+csv|tabela\s+em\s+csv)\s*:?[ \t]*\n```(?:csv|tsv)?\s*\n[\s\S]*?```/gi,
    "\n",
  );

  output = output.replace(/```(?:csv|tsv)\s*\n[\s\S]*?```/gi, "");

  output = output.replace(
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:vers[aã]o\s+em\s+csv|csv|planilha\s+em\s+csv|tabela\s+em\s+csv)\s*:?[ \t]*\n(?:(?:[^\n]*(?:;|\t)[^\n]*\n?)+)/gi,
    "\n",
  );

  return output.replace(/\n{3,}/g, "\n\n").trim();
}

function stripMarkdownForCopy(content: string) {
  return stripCsvSections(content)
    .replace(/```[\s\S]*?```/g, (match) =>
      match.replace(/```[a-zA-Z0-9_-]*\n?/g, "").replace(/```/g, ""),
    )
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


function renderMarkdownLikeChat(content: string) {
  return transformSingleItemBulletLists(normalizeAssistantMarkdown(content));
}

function transformSingleItemBulletLists(markdown: string) {
  const lines = String(markdown ?? "").split("\n");
  const result: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const bulletMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);

    if (!bulletMatch) {
      result.push(line);
      continue;
    }

    const indent = bulletMatch[1] ?? "";
    const block: string[] = [line];
    let nextIndex = index + 1;

    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex] ?? "";
      const nextBulletMatch = nextLine.match(/^(\s*)([-*+])\s+(.+)$/);

      if (!nextBulletMatch || (nextBulletMatch[1] ?? "") !== indent) {
        break;
      }

      block.push(nextLine);
      nextIndex += 1;
    }

    if (block.length === 1) {
      result.push(line.replace(/^(\s*)[-*+]\s+/, "$1"));
    } else {
      result.push(...block);
    }

    index = nextIndex - 1;
  }

  return result.join("\n");
}

function isInstitutionalHighlight(text: string) {
  const normalized = String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  return /^(importante|atencao|observacao|risco|recomendacao|alerta|nota)\s*:/.test(
    normalized,
  );
}

function SingleListItemBlock({ children }: { children: any }) {
  const items = Children.toArray(children).filter((child) => {
    return !(typeof child === "string" && child.trim().length === 0);
  });

  if (items.length !== 1) {
    return null;
  }

  const onlyItem = items[0];
  const content =
    isValidElement(onlyItem) && (onlyItem as any).props?.children
      ? (onlyItem as any).props.children
      : onlyItem;

  return (
    <div className="my-3 rounded-2xl bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-800">
      {content}
    </div>
  );
}

function normalizeAssistantMarkdown(content: string) {
  return linkLegalReferences(
    stripCsvSections(content)
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function atoFolderByYear(year: number) {
  if (year >= 2023 && year <= 2026) return "_ato2023-2026";
  if (year >= 2019 && year <= 2022) return "_ato2019-2022";
  if (year >= 2015 && year <= 2018) return "_ato2015-2018";
  if (year >= 2011 && year <= 2014) return "_ato2011-2014";
  if (year >= 2007 && year <= 2010) return "_ato2007-2010";
  if (year >= 2003 && year <= 2006) return "_ato2003-2006";
  if (year >= 1999 && year <= 2002) return "_ato1999-2002";

  return null;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function planaltoUrlForLegalReference(rawText: string) {
  const text = rawText.replace(/\s+/g, " ").trim();

  if (/constitui[cç][aã]o\s+federal/i.test(text) || /\bcf\/?88\b/i.test(text)) {
    return "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm";
  }

  const lcMatch = text.match(/lei\s+complementar\s+(?:n[ºo]\s*)?([\d.]+)\s*\/\s*(\d{4})/i);
  if (lcMatch) {
    if (!/\bfederal\b/i.test(text)) {
      return null;
    }

    const number = onlyDigits(lcMatch[1]);
    return `https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp${number}.htm`;
  }

  const lawMatch = text.match(/lei\s+(?:n[ºo]\s*)?([\d.]+)\s*\/\s*(\d{4})/i);
  if (lawMatch) {
    const number = onlyDigits(lawMatch[1]);
    const year = Number(lawMatch[2]);
    const folder = atoFolderByYear(year);

    if (folder) {
      return `https://www.planalto.gov.br/ccivil_03/${folder}/${year}/lei/l${number}.htm`;
    }

    return `https://www.planalto.gov.br/ccivil_03/leis/l${number}.htm`;
  }

  const decreeMatch = text.match(/decreto\s+(?:n[ºo]\s*)?([\d.]+)\s*\/\s*(\d{4})/i);
  if (decreeMatch) {
    const number = onlyDigits(decreeMatch[1]);
    const year = Number(decreeMatch[2]);
    const folder = atoFolderByYear(year);

    if (folder) {
      return `https://www.planalto.gov.br/ccivil_03/${folder}/${year}/decreto/d${number}.htm`;
    }

    return `https://www.planalto.gov.br/ccivil_03/decreto/d${number}.htm`;
  }

  return null;
}

function linkLegalReferences(markdown: string) {
  const legalRefRegex =
    /(Constituição Federal(?:\s+de\s+1988)?|CF\/?88|Lei Complementar\s+n?[ºo]?\s*[\d.]+\/\d{4}|Lei\s+n?[ºo]?\s*[\d.]+\/\d{4}|Decreto\s+n?[ºo]?\s*[\d.]+\/\d{4})/gi;

  return markdown.replace(legalRefRegex, (match, _p1, offset, fullText) => {
    const previous = fullText.slice(Math.max(0, offset - 2), offset);
    const next = fullText.slice(offset + match.length, offset + match.length + 2);

    if (previous.includes("[") || next.startsWith("](")) return match;

    const url = planaltoUrlForLegalReference(match);

    if (!url) return match;

    return `[${match}](${url})`;
  });
}

function getQuestion(messages: SharedMessage[]) {
  return messages.find((message) => message.role === "user");
}

function getAssistantMessages(messages: SharedMessage[]) {
  return messages.filter((message) => message.role !== "user");
}

function getLastAssistantMessage(messages: SharedMessage[]) {
  const assistantMessages = getAssistantMessages(messages);
  return assistantMessages[assistantMessages.length - 1] ?? null;
}

function getSingleSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim();
  }

  return String(value ?? "").trim();
}

function getMessageTime(message: SharedMessage) {
  const time = new Date(message.created_at ?? "").getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortMessagesForSharing(messages: SharedMessage[]) {
  return [...messages].sort((a, b) => {
    const timeDiff = getMessageTime(a) - getMessageTime(b);

    if (timeDiff !== 0) {
      return timeDiff;
    }

    const roleOrder = (role: string) => {
      if (role === "user") return 0;
      if (role === "assistant") return 1;
      return 2;
    };

    const roleDiff = roleOrder(a.role) - roleOrder(b.role);

    if (roleDiff !== 0) {
      return roleDiff;
    }

    return a.id.localeCompare(b.id);
  });
}

function findPreviousUserMessage(
  messages: SharedMessage[],
  startIndex: number,
) {
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return messages[index] ?? null;
    }
  }

  return null;
}

function findNextAssistantMessage(
  messages: SharedMessage[],
  startIndex: number,
) {
  for (let index = startIndex + 1; index < messages.length; index += 1) {
    const message = messages[index];

    if (!message) continue;
    if (message.role === "user") return null;
    if (message.role !== "user") return message;
  }

  return null;
}

function selectSharedInteraction(
  messages: SharedMessage[],
  rawMessageId: string,
) {
  const sortedMessages = sortMessagesForSharing(messages);

  if (!rawMessageId || !isUuid(rawMessageId)) {
    return {
      question: getQuestion(sortedMessages),
      assistantMessages: getAssistantMessages(sortedMessages),
      lastAssistantMessage: getLastAssistantMessage(sortedMessages),
      selectionError: null as string | null,
    };
  }

  const targetIndex = sortedMessages.findIndex(
    (message) => message.id === rawMessageId,
  );

  if (targetIndex < 0) {
    return {
      question: null,
      assistantMessages: [],
      lastAssistantMessage: null,
      selectionError:
        "Não foi possível localizar a mensagem específica deste link compartilhado.",
    };
  }

  const targetMessage = sortedMessages[targetIndex];

  if (!targetMessage) {
    return {
      question: null,
      assistantMessages: [],
      lastAssistantMessage: null,
      selectionError:
        "Não foi possível carregar a mensagem específica deste link compartilhado.",
    };
  }

  if (targetMessage.role === "user") {
    const nextAssistant = findNextAssistantMessage(sortedMessages, targetIndex);
    const assistantMessages = nextAssistant ? [nextAssistant] : [];

    return {
      question: targetMessage,
      assistantMessages,
      lastAssistantMessage: nextAssistant,
      selectionError: null,
    };
  }

  const previousQuestion = findPreviousUserMessage(sortedMessages, targetIndex);

  return {
    question: previousQuestion,
    assistantMessages: [targetMessage],
    lastAssistantMessage: targetMessage,
    selectionError: previousQuestion
      ? null
      : "A resposta foi localizada, mas não foi possível identificar a pergunta correspondente.",
  };
}

function getSharePageScript() {
  return `
    (() => {
      const setFeedback = (button, text) => {
        const original = button.getAttribute("data-label") || button.textContent || "";
        button.textContent = text;
        window.setTimeout(() => {
          button.textContent = original;
        }, 1800);
      };

      document.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const copyButton = target.closest("[data-copy-answer]");
        if (copyButton instanceof HTMLButtonElement) {
          const text = copyButton.getAttribute("data-copy-answer") || "";
          try {
            await navigator.clipboard.writeText(text);
            setFeedback(copyButton, "Copiado");
          } catch {
            setFeedback(copyButton, "Erro ao copiar");
          }
          return;
        }

        const shareButton = target.closest("[data-copy-share-link]");
        if (shareButton instanceof HTMLButtonElement) {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setFeedback(shareButton, "Link copiado");
          } catch {
            setFeedback(shareButton, "Erro ao copiar");
          }
        }
      });
    })();
  `;
}


function SharedMessageCard({ message }: { message: SharedMessage }) {
  if (message.role === "user") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[#0f3a4a]">
            <span className="text-xs font-black">?</span>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              Pergunta
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
              {formatDate(message.created_at)}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-900">
          {message.content}
        </div>
      </section>
    );
  }

  const csvDownloads = extractCsvDownloads(message.content, message.id);
  const cleanCopyText = stripMarkdownForCopy(message.content);

  return (
    <article
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[#0f3a4a]">
            <span className="text-xs font-black">IA</span>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              Resposta da Publ.IA
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
              {formatDate(message.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-copy-answer={cleanCopyText}
            data-label="Copiar"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-[#0f3a4a] shadow-sm transition hover:bg-slate-50"
          >
            Copiar
          </button>

          <button
            type="button"
            data-copy-share-link="true"
            data-label="Compartilhar link"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-[#0f3a4a] shadow-sm transition hover:bg-slate-50"
          >
            Compartilhar link
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="prose prose-slate max-w-none text-[13px] leading-6 prose-headings:font-bold prose-headings:text-[#0f3a4a] prose-h1:text-xl prose-h2:mt-6 prose-h2:border-t prose-h2:border-slate-200 prose-h2:pt-4 prose-h2:text-base prose-h3:mt-5 prose-h3:text-sm prose-h4:mt-4 prose-h4:text-sm prose-p:my-2.5 prose-strong:font-bold prose-strong:text-slate-950 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-a:font-semibold prose-a:text-[#0f3a4a] prose-a:underline prose-a:underline-offset-2 prose-hr:my-5 prose-hr:border-slate-200">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a
                  href={href || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#0f3a4a] underline underline-offset-2 transition hover:text-[#15586f]"
                >
                  {children}
                </a>
              ),
              h2: ({ children }) => (
                <h2 className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-black leading-6 text-[#0f3a4a]">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-5 rounded-xl bg-slate-50 px-4 py-2 text-sm font-black uppercase tracking-wide text-[#0f3a4a]">
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 className="mt-4 text-sm font-black text-slate-950">
                  {children}
                </h4>
              ),
              p: ({ children }) => {
                const text = extractTextFromNode(children);
                if (isCsvHeading(text)) return null;

                if (isInstitutionalHighlight(text)) {
                  return (
                    <p className="my-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-semibold leading-6 text-slate-800">
                      {children}
                    </p>
                  );
                }

                return (
                  <p className="my-3 text-[13px] leading-7 text-slate-800">
                    {children}
                  </p>
                );
              },
              ul: ({ children }) => {
                const items = Children.toArray(children).filter((child) => {
                  return !(typeof child === "string" && child.trim().length === 0);
                });

                if (items.length === 1) {
                  return <SingleListItemBlock>{children}</SingleListItemBlock>;
                }

                return (
                  <ul className="my-4 list-disc space-y-2 rounded-2xl bg-slate-50 px-6 py-4 text-[13px] leading-7 text-slate-800">
                    {children}
                  </ul>
                );
              },
              ol: ({ children }) => (
                <ol className="my-4 list-decimal space-y-2 rounded-2xl bg-slate-50 px-6 py-4 text-[13px] leading-7 text-slate-800">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="pl-1 leading-7 marker:text-slate-700">
                  {children}
                </li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-semibold leading-6 text-slate-800">
                  {children}
                </blockquote>
              ),
              code: ({ inline, className, children, ...props }: any) => {
                const language = /language-(\w+)/.exec(className ?? "")?.[1]?.toLowerCase();
                const text = String(children ?? "");

                if (!inline && (language === "csv" || language === "tsv" || looksLikeCsv(text))) {
                  return null;
                }

                return (
                  <code
                    {...props}
                    className="rounded bg-slate-100 px-1 py-0.5 text-[12px] text-[#0f3a4a]"
                  >
                    {children}
                  </code>
                );
              },
              pre: ({ children }: any) => {
                const text = extractTextFromNode(children);

                if (looksLikeCsv(text)) return null;

                return (
                  <pre className="my-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-50">
                    {children}
                  </pre>
                );
              },
              table: ({ children }) => (
                <div className="my-4 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="m-0 w-full min-w-[760px] border-collapse text-[12px]">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-bold leading-5 text-[#0f3a4a] last:border-r-0">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border-b border-r border-slate-100 px-3 py-2 align-top text-[12px] leading-5 text-slate-700 last:border-r-0">
                  {children}
                </td>
              ),
              hr: () => <hr className="my-5 border-slate-200" />,
            }}
          >
            {renderMarkdownLikeChat(message.content)}
          </ReactMarkdown>
        </div>

        {csvDownloads.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-start gap-2 border-t border-slate-100 pt-4">
            {csvDownloads.map((download) => (
              <a
                key={`${message.id}-${download.filename}`}
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(`\ufeff${normalizeCsvText(download.csv)}`)}`}
                download={download.filename}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0f3a4a] shadow-sm transition hover:border-[#0f3a4a] hover:bg-slate-50"
              >
                {download.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default async function GovernanceSharedConversationPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const shareId = String(params.shareId ?? "").trim();
  const selectedMessageId = getSingleSearchParam(resolvedSearchParams.messageId);

  if (!shareId || !isUuid(shareId)) notFound();

  const supabase = createPublicSupabaseClient();

  /*
    Quando existe messageId na URL, a página precisa partir da mensagem clicada,
    e não da primeira conversa encontrada pelo shareId. Isso evita compartilhar
    sempre a primeira interação quando a conversa tem várias perguntas/respostas.
  */
  let conversation: SharedConversation | null = null;
  let directMessageSelectionError: string | null = null;
  let directSelectedMessage: SharedMessage | null = null;
  let directQuestionMessage: SharedMessage | null = null;
  let directAssistantMessage: SharedMessage | null = null;

  if (selectedMessageId && isUuid(selectedMessageId)) {
    const { data: sharedMessage, error: sharedMessageError } = await supabase
      .from("governance_messages")
      .select("id, conversation_id, role, content, created_at")
      .eq("id", selectedMessageId)
      .maybeSingle<SharedMessage>();

    if (sharedMessageError) {
      console.error(
        "[governanca/share] erro ao buscar mensagem específica:",
        sharedMessageError,
      );
      notFound();
    }

    if (!sharedMessage?.conversation_id || !isUuid(sharedMessage.conversation_id)) {
      /*
        Em alguns ambientes, a consulta direta por id pode não retornar a linha
        por política de leitura, mesmo quando a mensagem aparece ao carregar a
        conversa compartilhada pelo shareId. Por isso, não exibimos erro aqui.

        A validação definitiva acontece depois, em selectSharedInteraction(),
        usando a lista completa de mensagens da conversa compartilhada.
      */
      console.warn(
        "[governanca/share] mensagem específica não retornou na busca direta; tentando localizar pela conversa compartilhada.",
        { selectedMessageId },
      );
    } else {
      directSelectedMessage = sharedMessage;

      const { data: conversationByMessage, error: conversationByMessageError } =
        await supabase
          .from("governance_conversations")
          .select("id, title, organization_id, created_at, is_shared, share_id")
          .eq("id", sharedMessage.conversation_id)
          .eq("share_id", shareId)
          .eq("is_shared", true)
          .maybeSingle<SharedConversation>();

      if (conversationByMessageError) {
        console.error(
          "[governanca/share] erro ao validar conversa da mensagem específica:",
          conversationByMessageError,
        );
        notFound();
      }

      if (!conversationByMessage) {
        directMessageSelectionError =
          "A mensagem específica foi localizada, mas não pertence a este link compartilhado.";
      } else {
        conversation = conversationByMessage;
      }
    }
  }

  if (!conversation) {
    const { data: conversationByShare, error: conversationError } = await supabase
      .from("governance_conversations")
      .select("id, title, organization_id, created_at, is_shared, share_id")
      .eq("share_id", shareId)
      .eq("is_shared", true)
      .maybeSingle<SharedConversation>();

    if (conversationError) {
      console.error("[governanca/share] erro ao buscar conversa:", conversationError);
      notFound();
    }

    if (!conversationByShare) notFound();

    conversation = conversationByShare;
  }

  if (directSelectedMessage && conversation) {
    if (directSelectedMessage.role === "user") {
      directQuestionMessage = directSelectedMessage;

      const { data: nextAssistant, error: nextAssistantError } = await supabase
        .from("governance_messages")
        .select("id, conversation_id, role, content, created_at")
        .eq("conversation_id", conversation.id)
        .neq("role", "user")
        .gt("created_at", directSelectedMessage.created_at ?? "")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<SharedMessage>();

      if (nextAssistantError) {
        console.error(
          "[governanca/share] erro ao buscar resposta posterior ao messageId:",
          nextAssistantError,
        );
      }

      directAssistantMessage = nextAssistant ?? null;
    } else {
      directAssistantMessage = directSelectedMessage;

      const { data: previousQuestion, error: previousQuestionError } =
        await supabase
          .from("governance_messages")
          .select("id, conversation_id, role, content, created_at")
          .eq("conversation_id", conversation.id)
          .eq("role", "user")
          .lt("created_at", directSelectedMessage.created_at ?? "")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<SharedMessage>();

      if (previousQuestionError) {
        console.error(
          "[governanca/share] erro ao buscar pergunta anterior ao messageId:",
          previousQuestionError,
        );
      }

      directQuestionMessage = previousQuestion ?? null;
    }
  }

  const { data: messages, error: messagesError } = await supabase
    .from("governance_messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .returns<SharedMessage[]>();

  if (messagesError) {
    console.error("[governanca/share] erro ao buscar mensagens:", messagesError);
    notFound();
  }

  const safeMessages = messages ?? [];

  const directSelection =
    selectedMessageId && directSelectedMessage && directAssistantMessage
      ? {
          question: directQuestionMessage,
          assistantMessages: [directAssistantMessage],
          lastAssistantMessage: directAssistantMessage,
          selectionError: directQuestionMessage
            ? null
            : "A resposta foi localizada, mas não foi possível identificar a pergunta correspondente.",
        }
      : null;

  const {
  question,
  assistantMessages,
  selectionError,
} = directMessageSelectionError
  ? {
      question: null,
      assistantMessages: [],
      selectionError: directMessageSelectionError,
    }
  : directSelection ?? selectSharedInteraction(safeMessages, selectedMessageId);

  const sharedMessagesForDisplay =
    selectedMessageId && isUuid(selectedMessageId)
      ? ([question, ...assistantMessages].filter(Boolean) as SharedMessage[])
      : sortMessagesForSharing(safeMessages);

  return (
    <main className="min-h-screen bg-[#e7e7e7] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[900px] items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-8 w-10 shrink-0">
              <Image
                src="/logos/logo-publia.png"
                alt="Logo Publ.IA"
                fill
                className="object-contain"
                priority
              />
            </div>

            <div className="h-7 w-px bg-slate-200" />

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                Conteúdo compartilhado via Publ.IA
              </p>
              <p className="truncate text-[11px] font-medium text-slate-500">
                Governança institucional
              </p>
            </div>
          </div>

          <a
            href="https://nexuspublica.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#0f3a4a] px-4 py-2 text-[11px] font-bold text-white shadow-sm transition hover:brightness-110"
          >
            Acessar Nexus Pública
          </a>
        </div>
      </header>

      <section className="mx-auto flex max-w-[900px] flex-col gap-4 px-4 py-5">
        {safeMessages.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Esta conversa ainda não possui mensagens públicas.
          </div>
        ) : selectionError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-800 shadow-sm">
            {selectionError}
          </div>
        ) : (
          <>
            {sharedMessagesForDisplay.map((message) => (
              <SharedMessageCard key={message.id} message={message} />
            ))}
          </>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-3 px-4 py-4 text-[11px] text-slate-500">
          <span>
            Compartilhado por <strong className="text-slate-800">Publ.IA</strong> — Nexus Pública
          </span>

          <span className="flex gap-3">
            <a
              href="https://nexuspublica.com.br/app-publ-ia/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#0f3a4a]"
            >
              Sobre
            </a>

            <a
              href="https://nexuspublica.com.br/termo-de-uso/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#0f3a4a]"
            >
              Termo de Uso
            </a>

            <a
              href="https://nexuspublica.com.br/contato/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#0f3a4a]"
            >
              Fale Conosco
            </a>
          </span>
        </div>
      </footer>

      <script dangerouslySetInnerHTML={{ __html: getSharePageScript() }} />
    </main>
  );
}