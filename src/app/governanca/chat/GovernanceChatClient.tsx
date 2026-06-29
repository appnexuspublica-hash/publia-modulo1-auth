// src/app/governanca/chat/GovernanceChatClient.tsx
"use client";

// FIX: rota de criação de conversa restaurada e sidebar sem fallback padrão
// FIX: nova conversa seleciona ID real antes de enviar mensagem
// FIX: sidebar conversa sem duplicar preview e sem fallback Nova conversa
import Link from "next/link";
import { Children, isValidElement, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart3,
  BookOpen,
  Bot,
  Clock3,
  Copy,
  FileText,
  FileSearch,
  Download,
  Landmark,
  Loader2,
  Lock,
  Search,
  MoreVertical,
  Pin,
  PinOff,
  Edit3,
  Trash2,
  Check,
  ChevronDown,
  MessageSquare,
  MessageSquarePlus,
  Paperclip,
  RotateCcw,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import GovernanceHeader from "../components/GovernanceHeader";
import {
  getGovernanceFunctionalRoleLabel,
  getGovernanceResponseModeLabel,
  getGovernanceTechnicalRoleLabel,
  getGovernanceVisibilityLabel,
  getOrganizationStatusLabel,
  type GovernanceContext,
  type GovernanceConversation,
  type GovernanceMessage,
} from "@/types/governance";

type GovernanceChatClientProps = {
  userId: string;
  userLabel: string;
  userEmail: string | null;
  context: GovernanceContext;
  initialConversations: GovernanceConversation[];
  initialMessages: GovernanceMessage[];
};

type StatusNavigationItem = {
  label: string;
  href: string;
  icon: typeof Landmark;
  enabled: boolean;
};

type LocalPdfAttachment = {
  id: string;
  name: string;
  size: number;
};

let browserSupabaseClient: SupabaseClient | null = null;

const PDF_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_PDF_BUCKET ||
  process.env.NEXT_PUBLIC_SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET ||
  "pdf-files";

function getBrowserSupabaseClient() {
  if (browserSupabaseClient) {
    return browserSupabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variáveis públicas do Supabase não configuradas.");
  }

  browserSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

  return browserSupabaseClient;
}

function sanitizeStorageFileName(fileName: string) {
  return String(fileName || "arquivo.pdf")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

const statusNavigationItems: StatusNavigationItem[] = [
  {
    label: "Visão geral",
    href: "/governanca",
    icon: Landmark,
    enabled: true,
  },
  {
    label: "Chat Governança",
    href: "/governanca/chat",
    icon: MessageSquare,
    enabled: true,
  },
  {
    label: "Usuários",
    href: "/governanca/usuarios",
    icon: Users,
    enabled: true,
  },
  {
    label: "Base institucional",
    href: "/governanca/base-institucional",
    icon: BookOpen,
    enabled: true,
  },
  {
    label: "Fontes oficiais",
    href: "/governanca/fontes-oficiais",
    icon: FileSearch,
    enabled: true,
  },
  {
    label: "Auditoria",
    href: "/governanca/auditoria",
    icon: ShieldCheck,
    enabled: true,
  },
  {
    label: "Indicadores",
    href: "/governanca/indicadores",
    icon: BarChart3,
    enabled: true,
  },
];

type SuggestedNextQuestion = {
  id: string;
  label: string;
  prompt: string;
};


function normalizeSuggestedNextQuestions(input: unknown): SuggestedNextQuestion[] {
  const source = Array.isArray(input) ? input : [];
  const seen = new Set<string>();

  return source
    .map((item, index) => {
      const rawLabel =
        typeof item === "string"
          ? item
          : (item as any)?.label ?? (item as any)?.question ?? (item as any)?.prompt;
      const rawPrompt =
        typeof item === "string"
          ? item
          : (item as any)?.prompt ?? (item as any)?.question ?? (item as any)?.label;

      const label = String(rawLabel ?? "").replace(/\s+/g, " ").trim();
      const prompt = String(rawPrompt ?? "").replace(/\s+/g, " ").trim();

      if (!label || !prompt) return null;

      const key = prompt.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);

      return {
        id: `ai-suggestion-${index + 1}-${key.slice(0, 24).replace(/[^a-z0-9]+/g, "-")}`,
        label: label.length > 120 ? `${label.slice(0, 117).trim()}...` : label,
        prompt,
      } satisfies SuggestedNextQuestion;
    })
    .filter((item): item is SuggestedNextQuestion => Boolean(item))
    .slice(0, 5);
}


const GOVERNANCE_STARTER_SUGGESTIONS: SuggestedNextQuestion[] = [
  {
    id: "starter-summary",
    label: "Gerar resumo executivo",
    prompt:
      "Gere um resumo executivo objetivo sobre o tema que eu enviar, destacando os pontos essenciais para decisão administrativa.",
  },
  {
    id: "starter-technical-opinion",
    label: "Criar parecer técnico",
    prompt:
      "Elabore um parecer técnico institucional sobre o tema que eu enviar, com assunto, relatório, fundamentação, análise, conclusão e recomendação técnica.",
  },
  {
    id: "starter-checklist",
    label: "Transformar em checklist",
    prompt:
      "Transforme o tema ou documento que eu enviar em um checklist prático de conferência para a Administração Pública Municipal.",
  },
  {
    id: "starter-manager-guidance",
    label: "Orientar gestor",
    prompt:
      "Explique o tema que eu enviar em linguagem de orientação ao gestor público, com cuidados, providências e próximo passo recomendado.",
  },
];


const responseModeOptions = [
  { value: "objective", label: "Padrão" },
  { value: "summary", label: "Resumo" },
  { value: "manager_guidance", label: "Orientação ao gestor" },
  { value: "checklist", label: "Checklist" },
  { value: "technical_opinion", label: "Parecer técnico" },
  { value: "risk_analysis", label: "Análise de risco" },
  { value: "attention_points", label: "Pontos de atenção" },
  { value: "action_plan", label: "Plano de ação" },
  { value: "draft", label: "Minuta" },
  { value: "comparison", label: "Comparativo" },
] as const;


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

  if (lines.length < 2) {
    return false;
  }

  const sample = lines.slice(0, 8).join("\n");
  const semicolons = (sample.match(/;/g) ?? []).length;
  const tabs = (sample.match(/\t/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;

  return semicolons >= 2 || tabs >= 2 || commas >= 4;
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

function extractTextFromNode(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromNode).join("");
  if (typeof node === "object" && "props" in node) {
    return extractTextFromNode((node as any).props?.children);
  }
  return "";
}

function getMarkdownListItems(children: any) {
  return Children.toArray(children).filter((child) => {
    if (!isValidElement(child)) return false;

    return String((child as any).type).toLowerCase() === "li";
  });
}

function getSingleMarkdownListItemContent(children: any) {
  const items = getMarkdownListItems(children);
  const firstItem = items[0] as any;

  return firstItem?.props?.children ?? firstItem ?? children;
}


function extractCsvDownloads(content: string, fallbackId = "tabela") {
  const source = String(content ?? "");
  const downloads: { filename: string; csv: string; label: string }[] = [];
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
      label: downloads.length > 0 ? `Baixar tabela/planilha ${downloads.length + 1}` : "Baixar tabela/planilha",
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


function stripMarkdownInline(value: string) {
  return String(value ?? "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMarkdownTableRow(line: string) {
  let cleaned = String(line ?? "").trim();

  if (cleaned.startsWith("|")) {
    cleaned = cleaned.slice(1);
  }

  if (cleaned.endsWith("|")) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned.split("|").map((cell) => stripMarkdownInline(cell));
}

function isMarkdownTableSeparator(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(
    String(line ?? "").trim(),
  );
}

function extractMarkdownTableDownloads(content: string, fallbackId = "tabela") {
  const lines = String(content ?? "").split("\n");
  const downloads: { filename: string; rows: string[][]; label: string }[] = [];
  let index = 0;

  while (index < lines.length - 1) {
    const headerLine = lines[index]?.trim() ?? "";
    const separatorLine = lines[index + 1]?.trim() ?? "";

    const isTableStart =
      headerLine.includes("|") && isMarkdownTableSeparator(separatorLine);

    if (!isTableStart) {
      index += 1;
      continue;
    }

    const tableLines = [lines[index]];

    let endIndex = index + 2;

    while (endIndex < lines.length) {
      const line = lines[endIndex]?.trim() ?? "";

      if (!line || !line.includes("|")) {
        break;
      }

      tableLines.push(lines[endIndex]);
      endIndex += 1;
    }

    const rows = tableLines
      .map(parseMarkdownTableRow)
      .filter((row) => row.some((cell) => cell.trim().length > 0));

    if (rows.length >= 2) {
      downloads.push({
        filename: `publia-governanca-${fallbackId}-tabela-${downloads.length + 1}.xlsx`,
        rows,
        label:
          downloads.length > 0
            ? `Baixar tabela/planilha ${downloads.length + 1}`
            : "Baixar tabela/planilha",
      });
    }

    index = endIndex;
  }

  return downloads;
}

function detectCsvDelimiter(csv: string) {
  const sample = normalizeCsvText(csv).split("\n").find(Boolean) ?? "";

  const candidates = [";", "\t", ","];
  return candidates
    .map((delimiter) => ({
      delimiter,
      count: (sample.match(new RegExp(delimiter === "\t" ? "\\t" : `\\${delimiter}`, "g")) ?? []).length,
    }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ";";
}

function parseDelimitedRows(text: string) {
  const delimiter = detectCsvDelimiter(text);

  return normalizeCsvText(text)
    .split("\n")
    .map((line) => line.split(delimiter).map((cell) => stripMarkdownInline(cell)))
    .filter((row) => row.some((cell) => cell.trim().length > 0));
}

function csvDownloadsToSpreadsheetDownloads(
  downloads: { filename: string; csv: string; label: string }[],
) {
  return downloads
    .map((download) => ({
      filename: download.filename.replace(/\.csv$/i, ".xlsx"),
      rows: parseDelimitedRows(download.csv),
      label: download.label,
    }))
    .filter((download) => download.rows.length > 0);
}

function escapeXml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getExcelColumnName(index: number) {
  let name = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }

  return name;
}

function buildWorksheetXml(rows: string[][]) {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((cell, columnIndex) => {
          const cellRef = `${getExcelColumnName(columnIndex)}${rowNumber}`;
          const style = rowIndex === 0 ? ' s="1"' : "";

          return `<c r="${cellRef}" t="inlineStr"${style}><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function getCrc32(bytes: Uint8Array) {
  let crc = 0 ^ -1;

  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ bytes[i]) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

const crc32Table = (() => {
  const table: number[] = [];

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
})();

function writeUint16(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function writeUint32(value: number) {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

function uint8ArrayToBlobPart(part: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(part.byteLength);
  copy.set(part);

  return copy.buffer;
}

function createZipFile(files: { name: string; content: string }[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const crc = getCrc32(contentBytes);

    const localHeader = new Uint8Array([
      ...writeUint32(0x04034b50),
      ...writeUint16(20),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint32(crc),
      ...writeUint32(contentBytes.length),
      ...writeUint32(contentBytes.length),
      ...writeUint16(nameBytes.length),
      ...writeUint16(0),
    ]);

    localParts.push(localHeader, nameBytes, contentBytes);

    const centralHeader = new Uint8Array([
      ...writeUint32(0x02014b50),
      ...writeUint16(20),
      ...writeUint16(20),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint32(crc),
      ...writeUint32(contentBytes.length),
      ...writeUint32(contentBytes.length),
      ...writeUint16(nameBytes.length),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint32(0),
      ...writeUint32(offset),
    ]);

    centralParts.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + contentBytes.length;
  }

  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array([
    ...writeUint32(0x06054b50),
    ...writeUint16(0),
    ...writeUint16(0),
    ...writeUint16(files.length),
    ...writeUint16(files.length),
    ...writeUint32(centralDirectorySize),
    ...writeUint32(offset),
    ...writeUint16(0),
  ]);

  const blobParts: BlobPart[] = [...localParts, ...centralParts, endRecord].map(
    uint8ArrayToBlobPart,
  );

  return new Blob(blobParts, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function createXlsxBlob(rows: string[][]) {
  const safeRows = rows.length > 0 ? rows : [["Sem dados"]];
  const worksheetXml = buildWorksheetXml(safeRows);

  return createZipFile([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Tabela" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: worksheetXml,
    },
  ]);
}


function hasMarkdownTable(content: string) {
  const lines = String(content ?? "").split("\n");

  return lines.some((line, index) => {
    const current = line.trim();
    const next = lines[index + 1]?.trim() ?? "";

    return (
      current.includes("|") &&
      /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(next)
    );
  });
}

function splitContentAfterFirstMarkdownTable(content: string): {
  beforeTableEnd: string;
  afterTableEnd: string;
  hasTable: boolean;
} {
  const source = String(content ?? "");
  const lines = source.split("\n");

  for (let index = 0; index < lines.length - 1; index += 1) {
    const current = lines[index]?.trim() ?? "";
    const next = lines[index + 1]?.trim() ?? "";

    const isTableStart =
      current.includes("|") &&
      /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(next);

    if (!isTableStart) {
      continue;
    }

    let endIndex = index + 2;

    while (endIndex < lines.length) {
      const line = lines[endIndex]?.trim() ?? "";

      if (!line || !line.includes("|")) {
        break;
      }

      endIndex += 1;
    }

    return {
      beforeTableEnd: lines.slice(0, endIndex).join("\n").trimEnd(),
      afterTableEnd: lines.slice(endIndex).join("\n").trimStart(),
      hasTable: true,
    };
  }

  return {
    beforeTableEnd: source,
    afterTableEnd: "",
    hasTable: false,
  };
}

function CsvDownloadButtons({
  downloads,
  messageId,
  onDownload,
  compact = false,
}: {
  downloads: { filename: string; rows: string[][]; label: string }[];
  messageId: string;
  onDownload: (rows: string[][], filename: string) => void;
  compact?: boolean;
}) {
  if (downloads.length === 0) {
    return null;
  }

  return (
    <div
      className={[
        "flex flex-wrap gap-2",
        compact ? "mb-2 mt-3 justify-start" : "justify-center border-t border-[#eeeeee] pt-4",
      ].join(" ")}
    >
      {downloads.map((download) => (
        <button
          key={`${messageId}-${download.filename}`}
          type="button"
          onClick={() => onDownload(download.rows, download.filename)}
          className="inline-flex items-center gap-2 rounded-full border border-[#dedede] bg-white px-4 py-2 text-xs font-semibold text-[#0f3a4a] shadow-sm transition hover:border-[#0f3a4a] hover:bg-[#eef5f7]"
        >
          <Download size={14} />
          {download.label}
        </button>
      ))}
    </div>
  );
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


function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdownForClipboard(value: string) {
  let html = escapeHtml(stripMarkdownInline(value));

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_match, label, url) =>
      `<a href="${escapeHtml(url)}" style="color:#0f3a4a;text-decoration:underline;font-weight:600;">${escapeHtml(label)}</a>`,
  );

  html = html
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.*?)__/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  return html;
}

function renderMarkdownTableForClipboard(rows: string[][]) {
  if (rows.length === 0) {
    return "";
  }

  const [header, ...bodyRows] = rows;

  const headerHtml = `<tr>${header
    .map(
      (cell) =>
        `<th style="border:1px solid #d9dee7;background:#f3f6f8;color:#0f3a4a;font-weight:700;text-align:left;padding:8px;vertical-align:top;">${renderInlineMarkdownForClipboard(cell)}</th>`,
    )
    .join("")}</tr>`;

  const bodyHtml = bodyRows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="border:1px solid #e5e7eb;padding:8px;vertical-align:top;color:#1f2937;">${renderInlineMarkdownForClipboard(cell)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `<table style="border-collapse:collapse;width:100%;margin:14px 0;font-size:13px;line-height:1.45;">${headerHtml}${bodyHtml}</table>`;
}

function markdownToClipboardHtml(content: string) {
  const markdown = normalizeAssistantMarkdown(content);
  const lines = markdown.split("\n");
  const blocks: string[] = [];
  let index = 0;

  function collectList(kind: "ul" | "ol") {
    const items: string[] = [];

    while (index < lines.length) {
      const line = lines[index] ?? "";
      const unordered = line.match(/^\s*[-*•]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);

      if (kind === "ul" && unordered) {
        items.push(`<li>${renderInlineMarkdownForClipboard(unordered[1])}</li>`);
        index += 1;
        continue;
      }

      if (kind === "ol" && ordered) {
        items.push(`<li>${renderInlineMarkdownForClipboard(ordered[1])}</li>`);
        index += 1;
        continue;
      }

      break;
    }

    blocks.push(
      `<${kind} style="margin:8px 0 12px 22px;padding:0;line-height:1.6;">${items.join("")}</${kind}>`,
    );
  }

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.includes("|") && isMarkdownTableSeparator(lines[index + 1] ?? "")) {
      const tableLines = [rawLine];
      index += 2;

      while (index < lines.length) {
        const nextLine = lines[index] ?? "";

        if (!nextLine.trim() || !nextLine.includes("|")) {
          break;
        }

        tableLines.push(nextLine);
        index += 1;
      }

      const rows = tableLines
        .map(parseMarkdownTableRow)
        .filter((row) => row.some((cell) => cell.trim().length > 0));

      blocks.push(renderMarkdownTableForClipboard(rows));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 3);
      const tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      const size = level === 1 ? "18px" : level === 2 ? "16px" : "14px";

      blocks.push(
        `<${tag} style="margin:18px 0 8px 0;color:#0f3a4a;font-size:${size};font-weight:700;line-height:1.35;">${renderInlineMarkdownForClipboard(heading[2])}</${tag}>`,
      );
      index += 1;
      continue;
    }

    if (/^\s*[-*_]{3,}\s*$/.test(line)) {
      blocks.push(`<hr style="border:0;border-top:1px solid #e5e7eb;margin:16px 0;" />`);
      index += 1;
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      collectList("ul");
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      collectList("ol");
      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (index < lines.length) {
      const next = (lines[index] ?? "").trim();

      if (
        !next ||
        next.includes("|") ||
        /^#{1,6}\s+/.test(next) ||
        /^\s*[-*•]\s+/.test(next) ||
        /^\s*\d+[.)]\s+/.test(next) ||
        /^\s*[-*_]{3,}\s*$/.test(next)
      ) {
        break;
      }

      paragraphLines.push(next);
      index += 1;
    }

    blocks.push(
      `<p style="margin:8px 0 12px 0;line-height:1.65;color:#111827;">${renderInlineMarkdownForClipboard(paragraphLines.join(" "))}</p>`,
    );
  }

  return `<!doctype html><html><body><div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111827;">${blocks.join("\n")}</div></body></html>`;
}

async function writeRichAnswerToClipboard(content: string) {
  const plainText = stripMarkdownForCopy(content);
  const html = markdownToClipboardHtml(content);
  const ClipboardItemCtor = (window as any).ClipboardItem;

  if (ClipboardItemCtor && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItemCtor({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);

    return;
  }

  await navigator.clipboard.writeText(plainText);
}

function getPlanaltoPeriodPath(year: number) {
  if (year >= 2023 && year <= 2026) return "_ato2023-2026";
  if (year >= 2019 && year <= 2022) return "_ato2019-2022";
  if (year >= 2015 && year <= 2018) return "_ato2015-2018";
  if (year >= 2011 && year <= 2014) return "_ato2011-2014";
  if (year >= 2007 && year <= 2010) return "_ato2007-2010";
  if (year >= 2003 && year <= 2006) return "_ato2003-2006";

  return "";
}

function buildOfficialLegalUrl(reference: string) {
  const normalized = reference.replace(/\s+/g, " ").trim();

  if (/Constituição Federal/i.test(normalized)) {
    return "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm";
  }

  const numberYear = normalized.match(/([\d.]+)\/(\d{4})/);
  if (!numberYear) {
    return null;
  }

  const rawNumber = numberYear[1].replace(/\D/g, "");
  const year = Number(numberYear[2]);
  const periodPath = getPlanaltoPeriodPath(year);

  if (/Lei\s+Complementar/i.test(normalized)) {
    return `https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp${rawNumber}.htm`;
  }

  if (/Lei/i.test(normalized)) {
    const looksLikeFederalOrdinaryLaw = rawNumber.length >= 4 || numberYear[1].includes(".");

    if (!looksLikeFederalOrdinaryLaw) {
      return null;
    }

    if (periodPath) {
      return `https://www.planalto.gov.br/ccivil_03/${periodPath}/${year}/lei/l${rawNumber}.htm`;
    }

    return `https://www.planalto.gov.br/ccivil_03/leis/l${rawNumber}.htm`;
  }

  if (/Decreto/i.test(normalized)) {
    const looksLikeFederalDecree = rawNumber.length >= 4 || numberYear[1].includes(".");

    if (!looksLikeFederalDecree) {
      return null;
    }

    if (periodPath) {
      return `https://www.planalto.gov.br/ccivil_03/${periodPath}/${year}/decreto/d${rawNumber}.htm`;
    }

    return `https://www.planalto.gov.br/ccivil_03/decreto/d${rawNumber}.htm`;
  }

  if (/Medida Provisória/i.test(normalized) && periodPath) {
    return `https://www.planalto.gov.br/ccivil_03/${periodPath}/${year}/mpv/mpv${rawNumber}.htm`;
  }

  return null;
}

function linkifyLegalReferences(content: string) {
  const legalReferencePattern =
    /\b(Constituição Federal(?: de 1988)?(?:\s*[—–-]\s*art\.?\s*\d+[º°]?)?|Lei(?:\s+Complementar)?\s+n[º°]?\s*[\d.]+\/\d{4}|Decreto\s+n[º°]?\s*[\d.]+\/\d{4}|Medida Provisória\s+n[º°]?\s*[\d.]+\/\d{4}|Portaria\s+n[º°]?\s*[\d.]+\/\d{4}|Instrução Normativa\s+n[º°]?\s*[\d.]+\/\d{4}|Resolução\s+n[º°]?\s*[\d.]+\/\d{4}|Emenda Constitucional\s+n[º°]?\s*[\d.]+)\b/gi;

  return content.replace(legalReferencePattern, (reference, _match, offset, fullText) => {
    const before = fullText.slice(Math.max(0, offset - 2), offset);
    const after = fullText.slice(offset + reference.length, offset + reference.length + 2);

    if (before.includes("[") || after.startsWith("](")) {
      return reference;
    }

    const officialUrl = buildOfficialLegalUrl(reference);

    if (!officialUrl) {
      return reference;
    }

    return `[${reference}](${officialUrl})`;
  });
}

function splitAssistantInlineSuggestion(content: string): {
  contentWithoutSuggestion: string;
  suggestionText: string | null;
} {
  const normalized = String(content ?? "").trim();

  if (!normalized) {
    return {
      contentWithoutSuggestion: "",
      suggestionText: null,
    };
  }

  const introPattern =
    /(?:^|\n)((?:se\s+(?:voc[eê]\s+)?(?:quiser|desejar)|caso\s+queira|se\s+preferir|posso\s+(?:tamb[eé]m\s+)?(?:preparar|montar|gerar|criar|transformar|elaborar)|posso[^\n]*se\s+(?:voc[eê]\s+)?quiser)[^\n]*)/i;

  const introMatch = normalized.match(introPattern);

  if (!introMatch || introMatch.index === undefined) {
    return {
      contentWithoutSuggestion: normalized,
      suggestionText: null,
    };
  }

  const introText = introMatch[1]?.trim();

  if (!introText || introText.length < 24) {
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

  const suggestionBlock = (introText + (listMatch ? listMatch[0] : "")).trim();
  const end = afterIntroStart + (listMatch ? listMatch[0].length : 0);

  let contentWithoutSuggestion =
    normalized.slice(0, start) + normalized.slice(end);

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

function extractAssistantActionSuggestions(content: string) {
  const { suggestionText } = splitAssistantInlineSuggestion(content);

  if (!suggestionText) {
    return [];
  }

  return [stripMarkdownForCopy(suggestionText).replace(/\s+/g, " ").trim()];
}

function improveListNestingAfterColon(markdown: string) {
  const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let activeParentIndent: number | null = null;
  let insideFence = false;

  function parseListLine(line: string) {
    const match = line.match(/^(\s*)((?:[-*+])|(?:\d+[.)]))\s+(.+)$/);

    if (!match) {
      return null;
    }

    return {
      indent: match[1].length,
      marker: match[2],
      content: match[3].trimEnd(),
    };
  }

  function endsWithColon(content: string) {
    return /[:：]\s*$/.test(content.trim());
  }

  function isMarkdownTableLine(line: string) {
    const trimmed = line.trim();
    return trimmed.includes("|") && /^\|?.+\|.+\|?$/.test(trimmed);
  }

  for (const originalLine of lines) {
    const trimmedLine = originalLine.trim();

    if (/^```/.test(trimmedLine)) {
      insideFence = !insideFence;
      activeParentIndent = null;
      output.push(originalLine);
      continue;
    }

    if (insideFence || isMarkdownTableLine(originalLine)) {
      output.push(originalLine);
      continue;
    }

    const parsed = parseListLine(originalLine);

    if (!parsed) {
      if (trimmedLine.length > 0) {
        activeParentIndent = null;
      }

      output.push(originalLine);
      continue;
    }

    const currentEndsWithColon = endsWithColon(parsed.content);

    if (currentEndsWithColon) {
      /*
        Mantém o item principal com marcador e prepara os próximos itens
        do mesmo nível para virarem sublista visual. Exemplo:

        - destruir ou ocultar documentos; pode responder por:

          - infração administrativa...
          - improbidade administrativa...

        A alteração é apenas de renderização: não muda a mensagem salva.
      */
      output.push(originalLine);

      if (output[output.length - 1]?.trim() !== "") {
        output.push("");
      }

      activeParentIndent = parsed.indent;
      continue;
    }

    if (activeParentIndent !== null && parsed.indent <= activeParentIndent) {
      output.push(
        `${" ".repeat(activeParentIndent + 2)}- ${parsed.content}`,
      );
      continue;
    }

    output.push(originalLine);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n");
}

function normalizeAssistantMarkdown(content: string) {
  return linkifyLegalReferences(
    improveListNestingAfterColon(content)
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s*---+\s*$/gm, "")
      .trim(),
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Agora";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatConversationHistoryDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sem data";
  }

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const dateKey = date.toLocaleDateString("pt-BR");
  const todayKey = today.toLocaleDateString("pt-BR");
  const yesterdayKey = yesterday.toLocaleDateString("pt-BR");

  if (dateKey === todayKey) {
    return "Hoje";
  }

  if (dateKey === yesterdayKey) {
    return "Ontem";
  }

  return dateKey;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function mergeMessages(
  currentMessages: GovernanceMessage[],
  newMessages: GovernanceMessage[],
) {
  const map = new Map<string, GovernanceMessage>();

  for (const message of currentMessages) {
    map.set(message.id, message);
  }

  for (const message of newMessages) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort((a, b) => {
    return (
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });
}

function getConversationPreview(messages: GovernanceMessage[]) {
  // O histórico deve identificar a conversa pela PRIMEIRA pergunta do usuário,
  // não pela última interação.
  const firstUserMessage = messages.find((message) => message.role === "user");

  if (!firstUserMessage) {
    return "";
  }

  const preview = firstUserMessage.content.replace(/\s+/g, " ").trim();

  if (preview.length <= 54) {
    return preview;
  }

  return `${preview.slice(0, 54)}...`;
}

function isDefaultConversationTitle(title: string | null | undefined) {
  const normalized = String(title ?? "").trim().toLowerCase();

  return (
    normalized === "" ||
    normalized === "nova conversa" ||
    normalized === "nova conversa institucional"
  );
}

function getConversationDisplayTitle(
  conversation: GovernanceConversation,
  conversationMessages: GovernanceMessage[],
) {
  if (!isDefaultConversationTitle(conversation.title)) {
    return conversation.title;
  }

  return getConversationPreview(conversationMessages);
}

function normalizeConversationSearchText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getConversationSearchText(
  conversation: GovernanceConversation,
  conversationMessages: GovernanceMessage[],
) {
  const displayTitle = getConversationDisplayTitle(
    conversation,
    conversationMessages,
  );

  const searchableMessages = conversationMessages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" ");

  return normalizeConversationSearchText(
    [
      conversation.title,
      displayTitle,
      getConversationPreview(conversationMessages),
      searchableMessages,
    ].join(" "),
  );
}

function buildMessageWithAttachments(
  content: string,
  attachments: LocalPdfAttachment[],
) {
  if (attachments.length === 0) {
    return content;
  }

  const attachmentList = attachments
    .map((file) => `- ${file.name} (${formatFileSize(file.size)})`)
    .join("\n");

  return [
    content,
    "",
    "PDFs selecionados para esta pergunta:",
    attachmentList,
    "",
    "Instrução operacional: considere apenas os PDFs selecionados nesta pergunta. Não use PDFs de mensagens anteriores, salvo se o usuário pedir comparação ou histórico.",
  ].join("\n");
}

function getLastUserMessage(messages: GovernanceMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user");
}

function getLastAssistantMessage(messages: GovernanceMessage[]) {
  return [...messages].reverse().find((message) => message.role === "assistant");
}


function isConversationPinned(conversation: GovernanceConversation) {
  return (
    (conversation as GovernanceConversation & { is_pinned?: boolean | null })
      .is_pinned === true
  );
}

export default function GovernanceChatClient({
  userId,
  userLabel,
  userEmail,
  context,
  initialConversations,
  initialMessages,
}: GovernanceChatClientProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [conversations, setConversations] =
    useState<GovernanceConversation[]>(initialConversations);

  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialConversations[0]?.id ?? null);
  const selectedConversationIdRef = useRef<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const stoppedByUserRef = useRef(false);

  const [messages, setMessages] =
    useState<GovernanceMessage[]>(initialMessages);

  const [messageText, setMessageText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [messageActionFeedback, setMessageActionFeedback] = useState<{
    messageId: string;
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [pdfAttachments, setPdfAttachments] = useState<LocalPdfAttachment[]>([]);
  const [selectedPdfAttachmentIds, setSelectedPdfAttachmentIds] = useState<string[]>([]);
  const [isPdfActionsMenuOpen, setIsPdfActionsMenuOpen] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [selectedResponseMode, setSelectedResponseMode] = useState(
    initialConversations[0]?.response_mode ?? "objective",
  );
  const [isResponseModeMenuOpen, setIsResponseModeMenuOpen] = useState(false);
  const [suggestionsByConversationId, setSuggestionsByConversationId] =
    useState<Record<string, SuggestedNextQuestion[]>>({});

  const [pendingAssistantConversationId, setPendingAssistantConversationId] =
    useState<string | null>(null);
  const [pendingUserMessageContent, setPendingUserMessageContent] =
    useState<string | null>(null);
  const [pendingUserMessageCreatedAt, setPendingUserMessageCreatedAt] =
    useState<string | null>(null);
  const [streamingAssistantText, setStreamingAssistantText] = useState("");

  const [isCreatingConversation, startCreateConversationTransition] =
    useTransition();
  const [isSendingMessage, startSendMessageTransition] = useTransition();

  const { organization, membership } = context;

  function setActiveConversationId(nextConversationId: string | null) {
    selectedConversationIdRef.current = nextConversationId;
    setSelectedConversationId(nextConversationId);
  }

  const selectedConversation = useMemo(() => {
    return (
      conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) ?? null
    );
  }, [conversations, selectedConversationId]);

  const selectedMessages = useMemo(() => {
    if (!selectedConversation) return [];

    return messages.filter(
      (message) => message.conversation_id === selectedConversation.id,
    );
  }, [messages, selectedConversation]);

  const messagesByConversationId = useMemo(() => {
    const map = new Map<string, GovernanceMessage[]>();

    for (const message of messages) {
      const list = map.get(message.conversation_id) ?? [];
      list.push(message);
      map.set(message.conversation_id, list);
    }

    return map;
  }, [messages]);

  const lastAssistantMessage = useMemo(
    () => getLastAssistantMessage(selectedMessages),
    [selectedMessages],
  );

  const isWaitingForAssistant =
    Boolean(selectedConversation) &&
    pendingAssistantConversationId === selectedConversation?.id;

  const filteredConversations = useMemo(() => {
    const q = normalizeConversationSearchText(conversationSearch);

    const list = conversations.filter((conversation) => {
      if (!q) return true;

      const conversationMessages = messagesByConversationId.get(conversation.id) ?? [];
      const searchableText = getConversationSearchText(
        conversation,
        conversationMessages,
      );

      return searchableText.includes(q);
    });

    return [...list].sort((a, b) => {
      const aPinned = isConversationPinned(a);
      const bPinned = isConversationPinned(b);

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }, [conversationSearch, conversations, messagesByConversationId]);

  const selectedModeLabel = useMemo(() => {
    return (
      responseModeOptions.find((item) => item.value === selectedResponseMode)?.label ??
      getGovernanceResponseModeLabel(selectedConversation?.response_mode ?? "objective")
    );
  }, [selectedConversation?.response_mode, selectedResponseMode]);

  const governanceSuggestions = useMemo(() => {
    if (!selectedConversation?.id) {
      return [] as SuggestedNextQuestion[];
    }

    return suggestionsByConversationId[selectedConversation.id] ?? [];
  }, [selectedConversation?.id, suggestionsByConversationId]);

  useEffect(() => {
    if (!messageActionFeedback) return;

    const timer = window.setTimeout(() => {
      setMessageActionFeedback(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [messageActionFeedback]);


  useEffect(() => {
    setMessages((currentMessages) =>
      mergeMessages(currentMessages, initialMessages),
    );
  }, [initialMessages]);

  useEffect(() => {
    if (selectedConversation?.response_mode) {
      setSelectedResponseMode(selectedConversation.response_mode);
    }
  }, [selectedConversation?.id, selectedConversation?.response_mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [selectedConversationId, selectedMessages.length, isWaitingForAssistant]);

  useEffect(() => {
    if (!actionFeedback) return;

    const timeout = window.setTimeout(() => {
      setActionFeedback(null);
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [actionFeedback]);

  async function handleCreateConversation() {
    setErrorMessage(null);
    setMessageError(null);

    startCreateConversationTransition(async () => {
      try {
        const response = await fetch("/api/governance/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "Nova conversa",
            category: null,
            responseMode: selectedResponseMode,
            visibility: "private",
          }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            payload?.error ?? "Não foi possível criar a conversa.",
          );
        }

        const createdConversationPayload = Array.isArray(payload?.conversation)
          ? payload.conversation[0]
          : payload?.conversation;

        if (!createdConversationPayload?.id) {
          throw new Error("A conversa foi criada, mas a API não retornou o ID.");
        }

        const createdConversation =
          createdConversationPayload as GovernanceConversation;

        setConversations((currentConversations) => [
          createdConversation,
          ...currentConversations.filter(
            (conversation) => conversation.id !== createdConversation.id,
          ),
        ]);
        setActiveConversationId(createdConversation.id);
        setMessageText("");
        setErrorMessage(null);
        setMessageError(null);
        setPendingAssistantConversationId(null);
        setPendingUserMessageContent(null);
        setPendingUserMessageCreatedAt(null);
        setStreamingAssistantText("");
        setPdfAttachments([]);
        setSelectedPdfAttachmentIds([]);
        setIsPdfActionsMenuOpen(false);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao criar conversa.";

        setErrorMessage(message);
        setMessageError(null);
      }
    });
  }

  function sendContent(
    rawContent: string,
    options?: {
      keepInputOnError?: boolean;
      attachmentsOverride?: LocalPdfAttachment[];
    },
  ) {
    const content = rawContent.trim();

    const conversationId =
      selectedConversationIdRef.current ?? selectedConversation?.id ?? "";

    if (!conversationId) {
      setMessageError("Selecione ou crie uma conversa antes de enviar.");
      return;
    }

    if (!content) {
      setMessageError("Digite uma mensagem antes de enviar.");
      return;
    }
    const selectedPdfAttachments =
      options?.attachmentsOverride ??
      (selectedPdfAttachmentIds.length > 0
        ? pdfAttachments.filter((file) => selectedPdfAttachmentIds.includes(file.id))
        : []);

    const contentToSend = buildMessageWithAttachments(content, selectedPdfAttachments);

    setMessageError(null);
    setMessageText("");
    setIsPdfActionsMenuOpen(false);
    setPendingAssistantConversationId(conversationId);
    setPendingUserMessageContent(content);
    setPendingUserMessageCreatedAt(new Date().toISOString());
    setStreamingAssistantText("");
    setSuggestionsByConversationId((current) => ({
      ...current,
      [conversationId]: [],
    }));

    stoppedByUserRef.current = false;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    startSendMessageTransition(async () => {
      try {
        const response = await fetch("/api/governance/chat", {
          method: "POST",
          signal: abortController.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            conversationId,
            content: contentToSend,
            responseMode: selectedResponseMode,
            selectedPdfFileIds: selectedPdfAttachments.map((file) => file.id),
            selectedPdfAttachmentNames: selectedPdfAttachments.map((file) => file.name),
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            payload?.error ?? "Não foi possível gerar a resposta da IA.",
          );
        }

        const contentType = response.headers.get("content-type") ?? "";

        if (!response.body || !contentType.includes("text/event-stream")) {
          const payload = await response.json();

          const newMessages = [
            payload.userMessage as GovernanceMessage,
            payload.assistantMessage as GovernanceMessage,
          ].filter(Boolean);

          setMessages((currentMessages) =>
            mergeMessages(currentMessages, newMessages),
          );

          setConversations((currentConversations) =>
            currentConversations.map((conversation) => {
              if (conversation.id !== conversationId) {
                return conversation;
              }

              const nextTitle =
                isDefaultConversationTitle(conversation.title) &&
                typeof payload?.conversationTitle === "string" &&
                payload.conversationTitle.trim().length > 0
                  ? payload.conversationTitle.trim()
                  : conversation.title;

              return {
                ...conversation,
                title: nextTitle,
                updated_at: new Date().toISOString(),
              };
            }),
          );

          const suggestions = normalizeSuggestedNextQuestions(payload?.suggestions);
          setSuggestionsByConversationId((current) => ({
            ...current,
            [conversationId]: suggestions,
          }));

          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        function handleStreamEvent(rawEvent: string) {
          const lines = rawEvent.split("\n");
          const eventLine = lines.find((line) => line.startsWith("event:"));
          const dataLines = lines.filter((line) => line.startsWith("data:"));

          const eventName = eventLine?.replace(/^event:\s*/, "").trim() || "message";
          const rawData = dataLines
            .map((line) => line.replace(/^data:\s*/, ""))
            .join("\n")
            .trim();

          if (!rawData) return;

          const data = JSON.parse(rawData);

          if (eventName === "userMessage" && data?.userMessage) {
            setMessages((currentMessages) =>
              mergeMessages(currentMessages, [data.userMessage as GovernanceMessage]),
            );
            setPendingUserMessageContent(null);
            return;
          }

          if (eventName === "delta") {
            const delta = typeof data?.delta === "string" ? data.delta : "";

            if (delta) {
              setStreamingAssistantText((current) => current + delta);
            }

            return;
          }

          if (eventName === "suggestions") {
            const suggestions = normalizeSuggestedNextQuestions(data?.suggestions);

            setSuggestionsByConversationId((current) => ({
              ...current,
              [conversationId]: suggestions,
            }));

            return;
          }

          if (eventName === "done") {
            const newMessages = [
              data.userMessage as GovernanceMessage,
              data.assistantMessage as GovernanceMessage,
            ].filter(Boolean);

            setMessages((currentMessages) =>
              mergeMessages(currentMessages, newMessages),
            );

            setConversations((currentConversations) =>
              currentConversations.map((conversation) => {
                if (conversation.id !== conversationId) {
                  return conversation;
                }

                const nextTitle =
                  isDefaultConversationTitle(conversation.title) &&
                  typeof data?.conversationTitle === "string" &&
                  data.conversationTitle.trim().length > 0
                    ? data.conversationTitle.trim()
                    : conversation.title;

                return {
                  ...conversation,
                  title: nextTitle,
                  updated_at: new Date().toISOString(),
                };
              }),
            );

            if (Array.isArray(data?.suggestions)) {
              const suggestions = normalizeSuggestedNextQuestions(data.suggestions);
              setSuggestionsByConversationId((current) => ({
                ...current,
                [conversationId]: suggestions,
              }));
            }

            setStreamingAssistantText("");
            return;
          }

          if (eventName === "error") {
            throw new Error(
              data?.error ?? "Erro ao gerar resposta da IA institucional.",
            );
          }
        }

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const rawEvent of events) {
            if (!rawEvent.trim()) continue;
            handleStreamEvent(rawEvent);
          }
        }

        buffer += decoder.decode();

        if (buffer.trim()) {
          handleStreamEvent(buffer);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setMessageError(null);
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao enviar mensagem.";

        setMessageError(message);

        if (options?.keepInputOnError !== false) {
          setMessageText(content);
        }
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }

        setPendingAssistantConversationId(null);
        setPendingUserMessageContent(null);
        setPendingUserMessageCreatedAt(null);
        setStreamingAssistantText("");
      }
    });
  }

  function handleStopMessage() {
    stoppedByUserRef.current = true;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    const interruptedText = streamingAssistantText.trimEnd();
    const marker = "\n\n*(Resposta interrompida pelo usuário.)*";
    const finalInterruptedText = interruptedText
      ? `${interruptedText}${marker}`
      : "*(Resposta interrompida pelo usuário.)*";

    if (selectedConversation?.id) {
      const interruptedMessage: GovernanceMessage = {
        id: `interrupted-${selectedConversation.id}-${Date.now()}`,
        organization_id: organization.id,
        conversation_id: selectedConversation.id,
        user_id: null,
        role: "assistant",
        content: finalInterruptedText,
        metadata: { interrupted_by_user: true },
        created_at: new Date().toISOString(),
      };

      setMessages((currentMessages) =>
        mergeMessages(currentMessages, [interruptedMessage]),
      );
    }

    setPendingAssistantConversationId(null);
    setPendingUserMessageContent(null);
    setPendingUserMessageCreatedAt(null);
    setStreamingAssistantText("");
    if (selectedConversation?.id) {
      setSuggestionsByConversationId((current) => ({
        ...current,
        [selectedConversation.id]: [],
      }));
    }
    setMessageError(null);
  }

  async function togglePinnedConversation(conversationId: string) {
    const targetConversation = conversations.find(
      (conversation) => conversation.id === conversationId,
    );

    if (!targetConversation) return;

    const nextPinnedValue = !(isConversationPinned(targetConversation));
    const previousConversations = conversations;

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? ({
              ...conversation,
              is_pinned: nextPinnedValue,
              updated_at: new Date().toISOString(),
            } as GovernanceConversation)
          : conversation,
      ),
    );
    setOpenConversationMenuId(null);
    setActionFeedback(
      nextPinnedValue ? "Conversa fixada." : "Conversa desfixada.",
    );

    try {
      const response = await fetch(`/api/governance/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: nextPinnedValue }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Não foi possível atualizar a fixação da conversa.",
        );
      }

      if (payload?.conversation?.id) {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, ...payload.conversation }
              : conversation,
          ),
        );
      }
    } catch (error) {
      setConversations(previousConversations);
      setMessageError(
        error instanceof Error
          ? error.message
          : "Não foi possível persistir a fixação da conversa.",
      );
    }
  }

  async function handleRenameConversation(conversationId: string) {
    const nextTitle = renameTitle.trim();

    if (!nextTitle) {
      setMessageError("Informe um título para renomear a conversa.");
      return;
    }

    const previousConversations = conversations;

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, title: nextTitle, updated_at: new Date().toISOString() }
          : conversation,
      ),
    );

    setRenamingConversationId(null);
    setOpenConversationMenuId(null);
    setActionFeedback("Conversa renomeada.");

    try {
      const response = await fetch(`/api/governance/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });

      if (!response.ok) {
        throw new Error("PATCH indisponível.");
      }
    } catch {
      setConversations(previousConversations);
      setMessageError("A conversa foi renomeada apenas nesta tela. Crie a rota PATCH para persistir no banco.");
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    const ok = window.confirm("Excluir esta conversa institucional? Esta ação não altera outros módulos.");
    if (!ok) return;

    const previousConversations = conversations;
    const previousSelectedId = selectedConversationId;
    const remaining = conversations.filter((conversation) => conversation.id !== conversationId);

    setConversations(remaining);
    setOpenConversationMenuId(null);

    if (selectedConversationId === conversationId) {
      setActiveConversationId(remaining[0]?.id ?? null);
    }

    setActionFeedback("Conversa removida da lista.");

    try {
      const response = await fetch(`/api/governance/conversations/${conversationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("DELETE indisponível.");
      }
    } catch {
      setConversations(previousConversations);
      setActiveConversationId(previousSelectedId);
      setMessageError("Não foi possível persistir a exclusão. Crie a rota DELETE para remover no banco.");
    }
  }

  function compactConversationCopyText(value: string) {
    return String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{2,}/g, "\n")
      .replace(/^\s*[-•]\s+/gm, "• ")
      .replace(/^\s*(\d+)[.)]\s+/gm, "$1. ")
      .trim();
  }

  function sortConversationMessagesForCopy(
    conversationMessages: GovernanceMessage[],
  ) {
    return [...conversationMessages].sort((a, b) => {
      const aTime = new Date(a.created_at ?? "").getTime();
      const bTime = new Date(b.created_at ?? "").getTime();

      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;

      return aTime - bTime;
    });
  }

  async function getConversationMessagesForAction(conversationId: string) {
    const localMessages = messagesByConversationId.get(conversationId) ?? [];

    try {
      const supabase = getBrowserSupabaseClient();

      const { data, error } = await supabase
        .from("governance_messages")
        .select("id, conversation_id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("[governance] Não foi possível carregar mensagens completas para ação:", error);
        return sortConversationMessagesForCopy(localMessages);
      }

      const remoteMessages = (data ?? []) as GovernanceMessage[];

      if (remoteMessages.length >= localMessages.length) {
        return sortConversationMessagesForCopy(remoteMessages);
      }

      return sortConversationMessagesForCopy(localMessages);
    } catch (error) {
      console.warn("[governance] Falha ao preparar mensagens da conversa:", error);
      return sortConversationMessagesForCopy(localMessages);
    }
  }

  function formatConversationForCopy(
    conversation: GovernanceConversation,
    conversationMessages: GovernanceMessage[],
  ) {
    const title = String(conversation.title ?? "Conversa").trim() || "Conversa";

    let questionNumber = 0;
    let answerNumber = 0;

    const body = sortConversationMessagesForCopy(conversationMessages)
      .map((message) => {
        const content = compactConversationCopyText(
          stripMarkdownForCopy(message.content),
        );

        if (!content) {
          return "";
        }

        if (message.role === "user") {
          questionNumber += 1;
          return [`PERGUNTA ${questionNumber}`, content].join("\n");
        }

        if (message.role === "assistant") {
          answerNumber += 1;
          return [`RESPOSTA ${answerNumber}`, content].join("\n");
        }

        return ["SISTEMA", content].join("\n");
      })
      .filter(Boolean)
      .join("\n\n");

    return [
      "PUBL.IA GOVERNANÇA",
      `CONVERSA: ${title}`,
      "",
      body,
    ]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function handleCopyConversation(conversation: GovernanceConversation) {
    try {
      const conversationMessages = await getConversationMessagesForAction(
        conversation.id,
      );

      if (conversationMessages.length === 0) {
        throw new Error("Esta conversa ainda não possui mensagens para copiar.");
      }

      await navigator.clipboard.writeText(
        formatConversationForCopy(conversation, conversationMessages),
      );

      setOpenConversationMenuId(null);
      setActionFeedback("Conversa copiada.");
    } catch (error) {
      setMessageError(
        error instanceof Error
          ? error.message
          : "Não foi possível copiar a conversa.",
      );
    }
  }

  async function handleShareConversation(conversation: GovernanceConversation) {
    try {
      setOpenConversationMenuId(null);
      setActionFeedback("Gerando link de compartilhamento...");

      const response = await fetch("/api/public/share/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: "governance",
          conversationId: conversation.id,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Não foi possível gerar o link de compartilhamento.",
        );
      }

      const shareUrl =
        typeof payload?.shareUrl === "string" && payload.shareUrl.trim()
          ? payload.shareUrl.trim()
          : payload?.shareId
            ? `${window.location.origin}/governanca/share/${payload.shareId}`
            : "";

      if (!shareUrl) {
        throw new Error("A API não retornou o link de compartilhamento.");
      }

      await navigator.clipboard.writeText(shareUrl);
      setActionFeedback("Link de compartilhamento copiado.");
    } catch (error) {
      setMessageError(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o link de compartilhamento.",
      );
    }
  }

  function startRenameConversation(conversation: GovernanceConversation) {
    setRenamingConversationId(conversation.id);
    setRenameTitle(conversation.title);
    setOpenConversationMenuId(null);
  }


  function handleSendMessage() {
    sendContent(messageText);
  }

  function handleMessageKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    handleSendMessage();
  }

  async function handleCopyMessage(message: GovernanceMessage) {
    try {
      const normalizeMessageCopyText = (value: string) =>
        stripMarkdownForCopy(value)
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .split("\n")
          .map((line) => line.replace(/[ \t]+/g, " ").trim())
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

      const renderClipboardParagraphs = (value: string) =>
        normalizeMessageCopyText(value)
          .split(/\n{2,}/)
          .map((paragraph) =>
            paragraph
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .join("<br />"),
          )
          .filter(Boolean)
          .map(
            (paragraph) =>
              `<p style="margin:0 0 10px 0;padding:0;font-size:16px;line-height:1.5;color:#111827;">${escapeHtml(
                paragraph,
              ).replace(/&lt;br \/&gt;/g, "<br />")}</p>`,
          )
          .join("");

      const renderBalancedClipboardHtml = (params: {
        questionText: string;
        answerText: string;
      }) => {
        const questionBlock = params.questionText
          ? `
            <div style="margin:0 0 14px 0;padding:0;">
              <div style="margin:0 0 6px 0;padding:0;font-size:13px;line-height:1.3;font-weight:700;letter-spacing:0.04em;color:#0f3a4a;">PERGUNTA</div>
              ${renderClipboardParagraphs(params.questionText)}
            </div>
          `
          : "";

        return `<!doctype html>
<html>
  <body>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111827;margin:0;padding:0;">
      ${questionBlock}
      <div style="margin:0 0 6px 0;padding:0;font-size:13px;line-height:1.3;font-weight:700;letter-spacing:0.04em;color:#0f3a4a;">RESPOSTA</div>
      ${renderClipboardParagraphs(params.answerText)}
    </div>
  </body>
</html>`;
      };

      const conversationMessages = sortConversationMessagesForCopy(
        messagesByConversationId.get(message.conversation_id) ?? selectedMessages,
      );

      const messageIndex = conversationMessages.findIndex(
        (item) => item.id === message.id,
      );

      const previousQuestion =
        messageIndex > -1
          ? [...conversationMessages]
              .slice(0, messageIndex)
              .reverse()
              .find((item) => item.role === "user")
          : null;

      const questionText = previousQuestion?.content
        ? normalizeMessageCopyText(previousQuestion.content)
        : "";

      const answerText = normalizeMessageCopyText(message.content);

      const contentToCopy = questionText
        ? ["PERGUNTA", "", questionText, "", "RESPOSTA", "", answerText].join("\n")
        : ["RESPOSTA", "", answerText].join("\n");

      const ClipboardItemCtor = (window as any).ClipboardItem;

      if (ClipboardItemCtor && navigator.clipboard?.write) {
        const html = renderBalancedClipboardHtml({
          questionText,
          answerText,
        });

        await navigator.clipboard.write([
          new ClipboardItemCtor({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([contentToCopy], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(contentToCopy);
      }

      setMessageActionFeedback({
        messageId: message.id,
        message: questionText ? "Pergunta e resposta copiadas." : "Resposta copiada.",
        tone: "success",
      });
    } catch {
      setMessageActionFeedback({
        messageId: message.id,
        message: "Não foi possível copiar automaticamente.",
        tone: "error",
      });
    }
  }

  function handleDownloadSpreadsheet(rows: string[][], filename: string) {
    try {
      const safeFilename = filename.toLowerCase().endsWith(".xlsx")
        ? filename
        : `${filename.replace(/\.[^.]+$/g, "")}.xlsx`;
      const blob = createXlsxBlob(rows);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMessageError("Não foi possível baixar a tabela/planilha.");
    }
  }

  async function handleShareMessage(message: GovernanceMessage) {
    try {
      const response = await fetch("/api/public/share/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: "governance",
          conversationId: message.conversation_id,
          messageId: message.id,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Não foi possível gerar o link de compartilhamento.",
        );
      }

      const shareUrl =
        typeof payload?.shareUrl === "string" && payload.shareUrl.trim()
          ? payload.shareUrl.trim()
          : payload?.shareId
            ? `${window.location.origin}/governanca/share/${payload.shareId}`
            : "";

      if (!shareUrl) {
        throw new Error("A API não retornou o link de compartilhamento.");
      }

      await navigator.clipboard.writeText(shareUrl);

      setMessageActionFeedback({
        messageId: message.id,
        message: "Link de compartilhamento copiado.",
        tone: "success",
      });
    } catch (error) {
      setMessageActionFeedback({
        messageId: message.id,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o link de compartilhamento.",
        tone: "error",
      });
    }
  }

  function handleRegenerateLast() {
    const lastUserMessage = getLastUserMessage(selectedMessages);

    if (!lastUserMessage) {
      setMessageError("Não há mensagem do usuário para regenerar.");
      return;
    }

    sendContent(lastUserMessage.content, { keepInputOnError: false });
  }

  function handleFillInputSuggestion(prompt: string) {
    const nextPrompt = String(prompt ?? "").trim();

    if (!nextPrompt) {
      return;
    }

    setMessageText(nextPrompt);

    requestAnimationFrame(() => {
      const textarea = messageInputRef.current;

      if (!textarea) {
        return;
      }

      textarea.focus();
      const end = nextPrompt.length;
      textarea.setSelectionRange(end, end);
    });
  }

  function handleSuggestionClick(prompt: string) {
    handleFillInputSuggestion(prompt);
  }

  async function handlePdfInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    const pdfs = files.filter((file) => file.type === "application/pdf");

    if (pdfs.length === 0) {
      setMessageError("Selecione um arquivo PDF válido.");
      input.value = "";
      return;
    }

    if (!selectedConversation) {
      setMessageError("Crie ou selecione uma conversa antes de anexar PDFs.");
      input.value = "";
      return;
    }

    setMessageError(null);
    setIsPdfActionsMenuOpen(false);
    setIsUploadingPdf(true);

    try {
      const nextAttachments: LocalPdfAttachment[] = [];

      for (const file of pdfs) {
        const formData = new FormData();
        formData.append("product", "governance");
        formData.append("conversationId", selectedConversation.id);
        formData.append("file", file, file.name);

        const uploadResponse = await fetch("/api/upload-pdf", {
          method: "POST",
          body: formData,
        });

        const uploadPayload = await uploadResponse.json().catch(() => null);

        if (!uploadResponse.ok) {
          throw new Error(
            uploadPayload?.error ??
              `Não foi possível enviar o PDF ${file.name}.`,
          );
        }

        const pdfFileId = String(
          uploadPayload?.id ??
            uploadPayload?.pdfFileId ??
            uploadPayload?.activePdfFileId ??
            "",
        ).trim();

        if (!pdfFileId) {
          throw new Error(
            `O upload do PDF ${file.name} não retornou o ID do arquivo.`,
          );
        }

        const fileName =
          typeof uploadPayload?.fileName === "string" && uploadPayload.fileName.trim()
            ? uploadPayload.fileName.trim()
            : file.name;

        const fileSize =
          typeof uploadPayload?.fileSize === "number" &&
          Number.isFinite(uploadPayload.fileSize)
            ? uploadPayload.fileSize
            : file.size;

        nextAttachments.push({
          id: pdfFileId,
          name: fileName,
          size: fileSize,
        });

        const indexResponse = await fetch("/api/pdf/index", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pdfFileId,
          }),
        });

        const indexPayload = await indexResponse.json().catch(() => null);

        if (!indexResponse.ok) {
          throw new Error(
            indexPayload?.error ??
              `O PDF ${fileName} foi enviado, mas não pôde ser preparado para leitura.`,
          );
        }
      }

      setPdfAttachments((current) => [...current, ...nextAttachments]);
      // Ao anexar novos PDFs em uma conversa já em andamento, eles passam a ser
      // os PDFs selecionados para a próxima pergunta. Os PDFs anteriores continuam
      // aparecendo na conversa, mas não ficam selecionados automaticamente para
      // evitar que ações rápidas usem contexto antigo por engano.
      setSelectedPdfAttachmentIds(nextAttachments.map((file) => file.id));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro inesperado ao anexar PDF.";

      setMessageError(message);
    } finally {
      setIsUploadingPdf(false);
      input.value = "";
    }
  }
  function removePdfAttachment(id: string) {
    setPdfAttachments((current) => current.filter((file) => file.id !== id));
    setSelectedPdfAttachmentIds((current) =>
      current.filter((selectedId) => selectedId !== id),
    );
    setIsPdfActionsMenuOpen(false);
  }

  function togglePdfAttachmentSelection(id: string) {
    setSelectedPdfAttachmentIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function applyPdfQuickAction(action: string) {
    const selectedPdfAttachments =
      selectedPdfAttachmentIds.length > 0
        ? pdfAttachments.filter((file) => selectedPdfAttachmentIds.includes(file.id))
        : [];

    if (selectedPdfAttachments.length === 0) {
      setMessageError("Selecione pelo menos um PDF para usar esta ação rápida.");
      setIsPdfActionsMenuOpen(false);
      return;
    }

    const selectedPdfNames = selectedPdfAttachments
      .map((file) => file.name)
      .join(", ");

    const actionPrompt = [
      action,
      "",
      `Considere os PDFs selecionados nesta mensagem: ${selectedPdfNames}.`,
      "Não use PDFs anteriores da conversa, salvo se eu pedir comparação ou histórico.",
    ].join("\n");

    setIsPdfActionsMenuOpen(false);
    sendContent(actionPrompt, {
      keepInputOnError: false,
      attachmentsOverride: selectedPdfAttachments,
    });
  }

  function renderAssistantContent(message: GovernanceMessage) {
    const { contentWithoutSuggestion, suggestionText } =
      splitAssistantInlineSuggestion(message.content);
    const csvDownloads = csvDownloadsToSpreadsheetDownloads(
      extractCsvDownloads(message.content, message.id),
    );
    const visibleContent = stripCsvSections(contentWithoutSuggestion);
    const inlineSuggestions = suggestionText
      ? [stripMarkdownForCopy(suggestionText).replace(/\s+/g, " ").trim()]
      : [];
    const tableSplit = splitContentAfterFirstMarkdownTable(visibleContent);
    const markdownTableDownloads = extractMarkdownTableDownloads(
      visibleContent,
      message.id,
    );
    const spreadsheetDownloads =
      csvDownloads.length > 0 ? csvDownloads : markdownTableDownloads;
    const shouldShowCsvButtonsNearTable =
      spreadsheetDownloads.length > 0 && tableSplit.hasTable;

    function renderMarkdownBlock(markdownContent: string) {
      if (!markdownContent.trim()) {
        return null;
      }

      return (
        <div className="governance-answer prose max-w-none prose-slate text-[15px] leading-8 prose-headings:font-bold prose-headings:text-slate-950 prose-p:my-3 prose-strong:font-bold prose-strong:text-slate-950 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-li:pl-1 prose-hr:my-5 prose-hr:border-[#dedede]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-semibold text-[#0f3a4a] underline underline-offset-2 transition hover:text-[#15586f]"
                />
              ),
              h1: ({ node, ...props }) => (
                <h1
                  {...props}
                  className="mb-4 mt-2 text-xl font-black leading-tight text-slate-950"
                />
              ),
              h2: ({ node, ...props }) => (
                <h2
                  {...props}
                  className="mb-3 mt-7 rounded-2xl border border-[#dedede] bg-[#f5f5f5] px-4 py-3 text-base font-black leading-snug text-[#0f3a4a]"
                />
              ),
              h3: ({ node, ...props }) => (
                <h3
                  {...props}
                  className="mb-2 mt-6 border-l-4 border-[#0f3a4a] pl-3 text-[15px] font-black uppercase tracking-wide text-[#0f3a4a]"
                />
              ),
              h4: ({ node, ...props }) => (
                <h4
                  {...props}
                  className="mb-2 mt-5 text-[15px] font-bold text-slate-950"
                />
              ),
              p: ({ node, ...props }) => {
                const text = extractTextFromNode((props as any).children).trim();
                if (isCsvHeading(text)) return null;

                const isHighlightedParagraph =
                  /^(aten[cç][aã]o|importante|observa[cç][aã]o|risco|alerta|recomenda[cç][aã]o|ponto de aten[cç][aã]o)\s*[:：-]/i.test(text);

                if (isHighlightedParagraph) {
                  return (
                    <div className="my-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[15px] leading-8 text-amber-950">
                      {props.children}
                    </div>
                  );
                }

                return <p {...props} className="my-3 text-[15px] leading-8 text-slate-800" />;
              },
              ul: ({ node, children, ...props }) => {
                const items = getMarkdownListItems(children);

                if (items.length === 1) {
                  return (
                    <div className="my-3 text-[15px] leading-8 text-slate-800">
                      {getSingleMarkdownListItemContent(children)}
                    </div>
                  );
                }

                return (
                  <ul
                    {...props}
                    className="my-3 list-disc space-y-1.5 pl-6"
                  >
                    {children}
                  </ul>
                );
              },
              ol: ({ node, children, ...props }) => {
                const items = getMarkdownListItems(children);

                if (items.length === 1) {
                  return (
                    <div className="my-3 text-[15px] leading-8 text-slate-800">
                      {getSingleMarkdownListItemContent(children)}
                    </div>
                  );
                }

                return (
                  <ol
                    {...props}
                    className="my-3 list-decimal space-y-1.5 pl-6"
                  >
                    {children}
                  </ol>
                );
              },
              li: ({ node, ...props }) => (
                <li {...props} className="pl-1 text-[15px] leading-8 text-slate-800" />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote
                  {...props}
                  className="my-4 border-l-4 border-[#0f3a4a] pl-4 text-[15px] font-medium leading-8 text-[#0f3a4a]"
                />
              ),
              hr: ({ node, ...props }) => (
                <hr {...props} className="my-5 border-[#dedede]" />
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
                    className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-semibold text-slate-800"
                  >
                    {children}
                  </code>
                );
              },
              pre: ({ children, ...props }: any) => {
                const text = extractTextFromNode(children);

                if (looksLikeCsv(text)) {
                  return null;
                }

                return (
                  <pre
                    {...props}
                    className="my-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-50"
                  >
                    {children}
                  </pre>
                );
              },
              table: ({ node, ...props }) => (
                <div className="my-4 overflow-x-auto rounded-2xl border border-[#dedede] bg-white shadow-sm">
                  <table
                    {...props}
                    className="m-0 min-w-full border-collapse text-left text-[13px]"
                  />
                </div>
              ),
              thead: ({ node, ...props }) => (
                <thead {...props} className="bg-[#f2f6f7]" />
              ),
              th: ({ node, ...props }) => (
                <th
                  {...props}
                  className="border-b border-r border-[#dedede] px-4 py-3 align-top text-xs font-black uppercase tracking-wide text-[#0f3a4a] last:border-r-0"
                />
              ),
              td: ({ node, ...props }) => (
                <td
                  {...props}
                  className="border-b border-r border-[#eeeeee] px-4 py-3 align-top leading-6 text-slate-700 last:border-r-0"
                />
              ),
            }}
          >
            {normalizeAssistantMarkdown(markdownContent)}
          </ReactMarkdown>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {renderMarkdownBlock(tableSplit.beforeTableEnd)}

        {shouldShowCsvButtonsNearTable && (
          <CsvDownloadButtons
            downloads={spreadsheetDownloads}
            messageId={message.id}
            onDownload={handleDownloadSpreadsheet}
            compact
          />
        )}

        {renderMarkdownBlock(tableSplit.afterTableEnd)}

        {spreadsheetDownloads.length > 0 && !tableSplit.hasTable && (
          <CsvDownloadButtons
            downloads={spreadsheetDownloads}
            messageId={message.id}
            onDownload={handleDownloadSpreadsheet}
          />
        )}

        {inlineSuggestions.length > 0 && (
          <button
            type="button"
            onClick={() => handleFillInputSuggestion(inlineSuggestions[0])}
            disabled={isSendingMessage}
            className="mt-5 w-full rounded-3xl border border-[#dedede] bg-white px-5 py-4 text-left text-xs font-semibold leading-6 text-[#0f3a4a] shadow-sm transition hover:border-[#0f3a4a] hover:bg-[#eef5f7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {inlineSuggestions[0]}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#f5f5f5] text-slate-900">
      <GovernanceHeader
        userLabel={userLabel}
        userEmail={userEmail}
        organizationName={organization.name}
        organizationStatusLabel={getOrganizationStatusLabel(organization.status)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {isStatusOpen && (
          <aside className="hidden w-80 shrink-0 border-r border-[#dedede] bg-[#e6e6e6] p-4 lg:flex lg:flex-col">
            <div className="rounded-3xl border border-[#dedede] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0f3a4a]">
                    Status institucional
                  </p>

                  <h2 className="mt-2 line-clamp-2 text-base font-bold text-slate-950">
                    {organization.name}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setIsStatusOpen(false)}
                  className="rounded-full bg-[#f5f5f5] p-2 text-slate-600 transition hover:bg-[#e6e6e6] hover:text-[#0f3a4a]"
                  aria-label="Ocultar status institucional"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="mt-4 grid gap-2 text-xs">
                <div className="rounded-2xl bg-[#e6e6e6] p-3 text-[#0f3a4a]">
                  <span className="block font-semibold">Papel funcional</span>
                  <span>
                    {getGovernanceFunctionalRoleLabel(
                      membership.functional_role,
                    )}
                  </span>
                </div>

                <div className="rounded-2xl bg-[#f5f5f5] p-3 text-slate-800">
                  <span className="block font-semibold">
                    Permissão técnica
                  </span>
                  <span>
                    {getGovernanceTechnicalRoleLabel(
                      membership.technical_role,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <nav className="mt-4 space-y-2">
              {statusNavigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === "/governanca/chat";

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={[
                      "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition",
                      isActive
                        ? "bg-[#0f3a4a] text-white shadow-sm"
                        : "text-slate-700 hover:bg-white hover:text-[#0f3a4a]",
                    ].join(" ")}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto rounded-3xl border border-[#dedede] bg-white p-4 text-xs leading-5 text-slate-600 shadow-sm">
              <strong className="text-slate-950">Publ.IA Governança</strong>
              <p className="mt-1">
                Dados institucionais do órgão, navegação administrativa e status
                do usuário ficam aqui sem ocupar o espaço principal do chat.
              </p>
            </div>
          </aside>
        )}

        <aside className="flex w-[292px] shrink-0 flex-col border-r border-[#dedede] bg-white">
          <div className="border-b border-[#dedede] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-950">Conversas</h2>

              <span className="rounded-full bg-[#e6e6e6] px-3 py-1.5 text-[11px] font-semibold text-[#0f3a4a]">
                {conversations.length}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCreateConversation}
              disabled={isCreatingConversation}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f3a4a] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCreatingConversation ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <MessageSquarePlus size={18} />
              )}
              Nova conversa
            </button>

            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-3 py-2 text-slate-600">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Pesquisar conversas"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
              />
            </div>

            {errorMessage && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMessage}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {conversations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#dedede] bg-[#f8f8f8] p-4 text-sm leading-6 text-slate-600">
                Nenhuma conversa ainda. Clique em{" "}
                <strong>Nova conversa</strong> para começar.
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredConversations.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#dedede] bg-[#f8f8f8] p-4 text-sm leading-6 text-slate-600">
                    Nenhuma conversa encontrada para a busca atual.
                  </div>
                )}

                {filteredConversations.map((conversation, index) => {
                  const isSelected =
                    conversation.id === selectedConversation?.id;

                  const conversationMessages =
                    messagesByConversationId.get(conversation.id) ?? [];

                  const conversationDisplayTitle = getConversationDisplayTitle(
                    conversation,
                    conversationMessages,
                  );

                  const dateLabel = formatConversationHistoryDate(
                    conversation.updated_at || conversation.created_at,
                  );
                  const previousConversation = filteredConversations[index - 1];
                  const previousDateLabel = previousConversation
                    ? formatConversationHistoryDate(
                        previousConversation.updated_at || previousConversation.created_at,
                      )
                    : null;
                  const shouldShowDate = dateLabel !== previousDateLabel;

                  return (
                    <div key={conversation.id}>
                      {shouldShowDate && (
                        <div className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 first:pt-0">
                          {dateLabel}
                        </div>
                      )}

                      <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveConversationId(conversation.id)}
                        className={[
                          "group w-full rounded-2xl px-3 py-3 pr-10 text-left transition",
                          isSelected
                            ? "bg-[#0f3a4a] text-white shadow-sm"
                            : "text-slate-700 hover:bg-[#f5f5f5] hover:text-slate-950",
                        ].join(" ")}
                      >
                        <div className="flex items-start gap-2">
                          {isConversationPinned(conversation) ? (
                            <Pin
                              size={15}
                              className={[
                                "mt-0.5 shrink-0",
                                isSelected ? "text-white" : "text-[#0f3a4a]",
                              ].join(" ")}
                            />
                          ) : (
                            <MessageSquare
                              size={16}
                              className={[
                                "mt-0.5 shrink-0",
                                isSelected ? "text-white" : "text-slate-400",
                              ].join(" ")}
                            />
                          )}

                          <div className="min-w-0 flex-1">
                            {renamingConversationId === conversation.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  value={renameTitle}
                                  onChange={(event) => setRenameTitle(event.target.value)}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void handleRenameConversation(conversation.id);
                                    }

                                    if (event.key === "Escape") {
                                      setRenamingConversationId(null);
                                    }
                                  }}
                                  className="min-w-0 flex-1 rounded-lg border border-[#dedede] bg-white px-2 py-1 text-xs text-slate-900 outline-none"
                                  autoFocus
                                />

                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleRenameConversation(conversation.id);
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#0f3a4a]"
                                >
                                  <Check size={14} />
                                </span>
                              </div>
                            ) : (
                              conversationDisplayTitle && (
                                <p className="line-clamp-2 break-words text-sm font-semibold leading-5">
                                  {conversationDisplayTitle}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenConversationMenuId((current) =>
                            current === conversation.id ? null : conversation.id,
                          );
                        }}
                        className={[
                          "absolute right-2 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full transition",
                          isSelected
                            ? "text-white/80 hover:bg-white/10 hover:text-white"
                            : "text-slate-400 hover:bg-[#e6e6e6] hover:text-[#0f3a4a]",
                        ].join(" ")}
                        aria-label="Opções da conversa"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {openConversationMenuId === conversation.id && (
                        <div className="absolute right-2 top-12 z-20 w-44 rounded-2xl border border-[#dedede] bg-white p-1 text-xs text-slate-700 shadow-xl">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void togglePinnedConversation(conversation.id);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold hover:bg-[#f5f5f5]"
                          >
                            {isConversationPinned(conversation) ? (
                              <PinOff size={14} />
                            ) : (
                              <Pin size={14} />
                            )}
                            {isConversationPinned(conversation)
                              ? "Desfixar"
                              : "Fixar"}
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              startRenameConversation(conversation);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold hover:bg-[#f5f5f5]"
                          >
                            <Edit3 size={14} />
                            Renomear
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCopyConversation(conversation);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold hover:bg-[#f5f5f5]"
                          >
                            <Copy size={14} />
                            Copiar
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleShareConversation(conversation);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold hover:bg-[#f5f5f5]"
                          >
                            <Share2 size={14} />
                            Compartilhar
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteConversation(conversation.id);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                            Excluir
                          </button>
                        </div>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-[#f8f8f8]">
          {selectedConversation ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto max-w-6xl">
                  {selectedMessages.length === 0 && !isWaitingForAssistant ? (
                    <div className="flex min-h-[58vh] items-center justify-center">
                      <div className="max-w-2xl text-center">
                        <p className="text-sm leading-6 text-slate-800">
                          Sou Publ.IA, Inteligência Artificial especializada em
                          Gestão Pública, Licitações e Contratos.
                          <br />
                          Atuo para fortalecer a eficiência, a transparência e a
                          segurança jurídica na Administração Pública Municipal.
                        </p>

                        <h2 className="mt-6 text-2xl font-bold text-slate-800">
                          Como posso ajudar você?
                        </h2>

                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                          {GOVERNANCE_STARTER_SUGGESTIONS.map((suggestion) => (
                            <button
                              key={suggestion.id}
                              type="button"
                              onClick={() => handleFillInputSuggestion(suggestion.prompt)}
                              className="rounded-full border border-[#dedede] bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#0f3a4a] hover:text-[#0f3a4a]"
                            >
                              {suggestion.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-7 pb-4">
                      {selectedMessages.map((message) => {
                        const isCurrentUser =
                          message.role === "user" && message.user_id === userId;

                        const isAssistant = message.role === "assistant";
                        const isLastAssistant =
                          lastAssistantMessage?.id === message.id;

                        return (
                          <div key={message.id} className="flex justify-start">
                            <div
                              className={[
                                "w-full",
                                isCurrentUser ? "max-w-[76%]" : "max-w-[92%]",
                              ].join(" ")}
                            >
                              {isCurrentUser && (
                                <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                                  <Clock3 size={12} />
                                  {formatDateTime(message.created_at)}
                                </p>
                              )}

                              <div
                                className={[
                                  "break-words rounded-3xl px-5 py-4 text-sm leading-7 shadow-sm",
                                  isCurrentUser
                                    ? "bg-[#0f3a4a] text-white"
                                    : "border border-[#dedede] bg-white text-slate-800",
                                ].join(" ")}
                              >
                                {isAssistant ? (
                                  renderAssistantContent(message)
                                ) : (
                                  <div className="whitespace-pre-wrap">
                                    {message.content}
                                  </div>
                                )}

                                {isAssistant && (
                                  <div className="mt-4 border-t border-[#eeeeee] pt-3">
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCopyMessage(message)
                                        }
                                        className="inline-flex items-center gap-1 rounded-full border border-[#dedede] px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-[#0f3a4a] hover:text-[#0f3a4a]"
                                      >
                                        <Copy size={13} />
                                        Copiar
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleShareMessage(message)
                                        }
                                        className="inline-flex items-center gap-1 rounded-full border border-[#dedede] px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-[#0f3a4a] hover:text-[#0f3a4a]"
                                      >
                                        <Share2 size={13} />
                                        Compartilhar
                                      </button>

                                      <button
                                        type="button"
                                        onClick={handleRegenerateLast}
                                        disabled={isSendingMessage}
                                        className="inline-flex items-center gap-1 rounded-full border border-[#dedede] px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-[#0f3a4a] hover:text-[#0f3a4a] disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        <RotateCcw size={13} />
                                        Regenerar
                                      </button>
                                    </div>

                                    {messageActionFeedback?.messageId === message.id && (
                                      <div
                                        className={[
                                          "mx-auto mt-3 w-fit rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                                          messageActionFeedback.tone === "success"
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-red-200 bg-red-50 text-red-700",
                                        ].join(" ")}
                                      >
                                        {messageActionFeedback.message}
                                      </div>
                                    )}

                                    {isLastAssistant && governanceSuggestions.length > 0 && (
                                      <div className="mt-4 text-center">
                                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                          Sugestões de próxima pergunta
                                        </p>

                                        <div className="flex flex-wrap justify-center gap-2">
                                          {governanceSuggestions.map((suggestion) => (
                                            <button
                                              key={suggestion.id}
                                              type="button"
                                              onClick={() =>
                                                handleSuggestionClick(suggestion.prompt)
                                              }
                                              disabled={isSendingMessage}
                                              className="rounded-full bg-[#f5f5f5] px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-[#e6e6e6] hover:text-[#0f3a4a] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                              {suggestion.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {isWaitingForAssistant && pendingUserMessageContent && (
                        <div className="flex justify-start">
                          <div className="w-full max-w-[76%]">
                            <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                              <Clock3 size={12} />
                              {formatDateTime(
                                pendingUserMessageCreatedAt ?? new Date().toISOString(),
                              )}
                            </p>

                            <div className="break-words rounded-3xl bg-[#0f3a4a] px-5 py-4 text-sm leading-7 text-white shadow-sm">
                              <div className="whitespace-pre-wrap">
                                {pendingUserMessageContent}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {isWaitingForAssistant && (
                        <div className="flex justify-start">
                          <div className="max-w-[92%] rounded-3xl border border-[#dedede] bg-white px-5 py-4 text-sm leading-7 text-slate-700 shadow-sm">
                            {streamingAssistantText.trim() ? (
                              renderAssistantContent({
                                id: "streaming-assistant",
                                organization_id: organization.id,
                                conversation_id: selectedConversation?.id ?? "",
                                user_id: null,
                                role: "assistant",
                                content: streamingAssistantText,
                                metadata: {},
                                created_at: new Date().toISOString(),
                              })
                            ) : (
                              <div className="flex items-center gap-2">
                                <Loader2
                                  size={16}
                                  className="animate-spin text-[#0f3a4a]"
                                />
                                <span>Elaborando resposta institucional...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              </div>

              <footer className="border-t border-[#dedede] bg-white px-4 py-4">
                <div className="mx-auto max-w-6xl">
                  {messageError && (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {messageError}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="hidden"
                    onChange={handlePdfInputChange}
                  />

                  {pdfAttachments.length > 0 && (
                    <div className="mb-3 rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          PDFs desta mensagem
                        </p>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsPdfActionsMenuOpen((open) => !open)}
                            disabled={isSendingMessage || isUploadingPdf || selectedPdfAttachmentIds.length === 0}
                            className="inline-flex items-center gap-2 rounded-full border border-[#dedede] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0f3a4a] transition hover:border-[#0f3a4a] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Ações rápidas com PDFs
                            <ChevronDown size={13} />
                          </button>

                          {isPdfActionsMenuOpen && (
                            <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-[#dedede] bg-white p-2 shadow-xl">
                              {[
                                "Resumir PDFs selecionados",
                                "Extrair obrigações dos PDFs",
                                "Listar riscos encontrados",
                                "Gerar checklist com base nos PDFs",
                                "Gerar parecer técnico com base nos PDFs",
                                "Comparar os PDFs selecionados",
                              ].map((action) => (
                                <button
                                  key={action}
                                  type="button"
                                  onClick={() => applyPdfQuickAction(action)}
                                  disabled={isSendingMessage || isUploadingPdf || selectedPdfAttachmentIds.length === 0}
                                  className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-[#f2f6f7] hover:text-[#0f3a4a] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {pdfAttachments.map((file) => {
                          const isSelected = selectedPdfAttachmentIds.includes(file.id);

                          return (
                            <div
                              key={file.id}
                              className={[
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
                                isSelected
                                  ? "border-[#0f3a4a] bg-[#e6f0f3] text-[#0f3a4a]"
                                  : "border-[#dedede] bg-white text-slate-600",
                              ].join(" ")}
                            >
                              <button
                                type="button"
                                onClick={() => togglePdfAttachmentSelection(file.id)}
                                className="inline-flex items-center gap-1 font-semibold"
                                title={
                                  isSelected
                                    ? "Remover este PDF do próximo envio"
                                    : "Incluir este PDF no próximo envio"
                                }
                              >
                                <span
                                  className={[
                                    "inline-flex h-4 w-4 items-center justify-center rounded border text-[10px]",
                                    isSelected
                                      ? "border-[#0f3a4a] bg-[#0f3a4a] text-white"
                                      : "border-slate-300 bg-white text-transparent",
                                  ].join(" ")}
                                >
                                  ✓
                                </span>
                                <FileText size={13} />
                                <span className="max-w-[220px] truncate">
                                  {file.name}
                                </span>
                              </button>

                              <span className="text-slate-500">
                                {formatFileSize(file.size)}
                              </span>

                              <button
                                type="button"
                                onClick={() => removePdfAttachment(file.id)}
                                className="rounded-full p-0.5 text-slate-500 hover:bg-white hover:text-red-600"
                                aria-label="Remover PDF"
                                title="Remover PDF"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <div className="flex min-w-0 flex-1 items-end gap-3 rounded-3xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm text-slate-700 shadow-sm">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSendingMessage || isUploadingPdf}
                        className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dedede] bg-white text-slate-600 transition hover:border-[#0f3a4a] hover:text-[#0f3a4a] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Anexar PDF"
                        title="Anexar PDF"
                      >
                        <Paperclip size={18} />
                      </button>

                      <textarea
                        ref={messageInputRef}
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        onKeyDown={handleMessageKeyDown}
                        disabled={isSendingMessage || isUploadingPdf}
                        rows={1}
                        placeholder={
                          isUploadingPdf
                            ? "Preparando PDF para leitura..."
                            : isSendingMessage
                              ? "A Publ.IA Governança está respondendo..."
                              : "Digite sua mensagem..."
                        }
                        className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 outline-none placeholder:text-slate-400"
                      />

                      {isSendingMessage ? (
                        <button
                          type="button"
                          onClick={handleStopMessage}
                          className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                          aria-label="Parar geração da resposta"
                          title="Parar"
                        >
                          ■
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendMessage}
                          disabled={!messageText.trim()}
                          className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f3a4a] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Enviar mensagem"
                        >
                          <Send size={18} />
                        </button>
                      )}
                    </div>

                    <div className="relative shrink-0 lg:w-52">
                      <button
                        type="button"
                        onClick={() =>
                          setIsResponseModeMenuOpen((current) => !current)
                        }
                        disabled={isSendingMessage}
                        className="flex h-[58px] w-full items-center justify-between gap-3 rounded-3xl border border-[#dedede] bg-white px-4 text-left text-xs font-semibold text-[#0f3a4a] outline-none transition hover:border-[#0f3a4a] focus:border-[#0f3a4a] disabled:cursor-not-allowed disabled:opacity-70"
                        aria-haspopup="listbox"
                        aria-expanded={isResponseModeMenuOpen}
                        aria-label="Modo de resposta"
                      >
                        <span>{selectedModeLabel}</span>
                        <ChevronDown
                          size={16}
                          className={[
                            "shrink-0 transition-transform",
                            isResponseModeMenuOpen ? "rotate-180" : "",
                          ].join(" ")}
                        />
                      </button>

                      {isResponseModeMenuOpen && (
                        <div
                          className="absolute bottom-[68px] right-0 z-50 w-72 rounded-3xl border border-[#dedede] bg-white p-2 text-slate-700 shadow-xl"
                          role="listbox"
                          aria-label="Modo de resposta"
                        >
                          <div className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#0f3a4a]">
                            Modo de resposta
                          </div>

                          <div className="space-y-0.5">
                            {responseModeOptions.map((option) => {
                              const isSelected =
                                option.value === selectedResponseMode;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  onClick={() => {
                                    setSelectedResponseMode(option.value as any);
                                    setIsResponseModeMenuOpen(false);
                                  }}
                                  className={[
                                    "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm font-semibold transition",
                                    isSelected
                                      ? "bg-[#eef5f7] text-[#0f3a4a]"
                                      : "text-slate-700 hover:bg-[#f5f5f5] hover:text-[#0f3a4a]",
                                  ].join(" ")}
                                >
                                  <span>{option.label}</span>
                                  {isSelected && <Check size={16} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    As respostas devem ser revisadas pela área técnica
                    competente quando envolverem decisão administrativa.
                  </p>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-xl text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
                  <MessageSquarePlus size={26} />
                </div>

                <h2 className="text-xl font-bold text-slate-950">
                  Crie a primeira conversa institucional
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Clique em <strong>Nova conversa</strong> para iniciar o uso do
                  Chat Governança.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
