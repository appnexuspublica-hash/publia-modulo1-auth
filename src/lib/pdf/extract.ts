//src/lib/pdf/extract.ts
import OpenAI from "openai";
import { extractText, getDocumentProxy } from "unpdf";

export const DEFAULT_EXTRACT_TEXT_HARD_LIMIT = 250_000;

export type PdfExtractResult =
  | { kind: "ready"; text: string }
  | { kind: "no_text" }
  | { kind: "technical_error"; error: string }
  | { kind: "skipped_large"; error: string };

type ExtractPdfTextOptions = {
  hardLimit?: number;
  fileSizeBytes?: number | null;
  maxBytes?: number | null;
  maxMbLabel?: number | null;
  /**
   * Quando true, tenta OCR mesmo se a extração nativa já retornou texto.
   * Útil para Diários Oficiais com páginas mistas: texto selecionável + páginas escaneadas/imagem.
   */
  preferOcr?: boolean;
};

const OCR_ENABLED = String(process.env.PDF_OCR_ENABLED ?? "true").toLowerCase() !== "false";
const OCR_MODEL =
  process.env.OPENAI_PDF_OCR_MODEL ||
  process.env.OPENAI_OCR_MODEL ||
  "gpt-4.1-mini";

const OCR_MAX_MB = Number(process.env.PDF_OCR_MAX_MB ?? 12);
const OCR_MIN_TEXT_LENGTH = Number(process.env.PDF_OCR_MIN_TEXT_LENGTH ?? 80);

let openai: OpenAI | null = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function sanitizeExtractedText(
  raw: string,
  hardLimit = DEFAULT_EXTRACT_TEXT_HARD_LIMIT
) {
  let text = String(raw ?? "");
  text = text.replace(/\u0000/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\r/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.trim();

  if (text.length > hardLimit) {
    text = text.slice(0, hardLimit);
  }

  return text;
}

export function getNoTextPdfMessage() {
  return "PDF sem texto detectável. Ele pode ser imagem/escaneado; faça OCR e reenvie se quiser pesquisa de trechos.";
}

export function getSkippedLargePdfMessage(maxMbLabel?: number | null) {
  if (
    typeof maxMbLabel === "number" &&
    Number.isFinite(maxMbLabel) &&
    maxMbLabel > 0
  ) {
    return `PDF grande demais para extração automática (${maxMbLabel} MB). Faça OCR/versão menor.`;
  }

  return "PDF grande demais para extração automática. Faça OCR/versão menor.";
}

function normalizeBufferInput(buf: Buffer): Uint8Array {
  return new Uint8Array(buf);
}

function getBufferSizeMb(buf: Buffer) {
  return buf.length / (1024 * 1024);
}

function shouldAttemptOcr(buf: Buffer) {
  if (!OCR_ENABLED) {
    return {
      allowed: false,
      reason: "OCR desativado por PDF_OCR_ENABLED=false.",
    };
  }

  if (!openai) {
    return {
      allowed: false,
      reason: "OPENAI_API_KEY ausente.",
    };
  }

  if (!Number.isFinite(OCR_MAX_MB) || OCR_MAX_MB <= 0) {
    return {
      allowed: false,
      reason: "PDF_OCR_MAX_MB inválido.",
    };
  }

  const sizeMb = getBufferSizeMb(buf);

  if (sizeMb > OCR_MAX_MB) {
    return {
      allowed: false,
      reason: `PDF acima do limite de OCR (${sizeMb.toFixed(1)} MB > ${OCR_MAX_MB} MB).`,
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}

function extractOutputText(response: any): string {
  const direct = response?.output_text;

  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  const parts: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const contentItem of content) {
      const text =
        typeof contentItem?.text === "string"
          ? contentItem.text
          : typeof contentItem?.content === "string"
            ? contentItem.content
            : "";

      if (text.trim()) {
        parts.push(text);
      }
    }
  }

  return parts.join("\n\n");
}

async function extractByOpenAiOcr(
  buf: Buffer,
  hardLimit: number
): Promise<string> {
  if (!openai) {
    return "";
  }

  const fileData = `data:application/pdf;base64,${buf.toString("base64")}`;

  const response = await (openai as any).responses.create({
    model: OCR_MODEL,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Extraia todo o texto legível deste PDF escaneado ou em imagem.",
              "Preserve a ordem de leitura.",
              "Quando houver tabelas, transcreva em texto simples ou Markdown.",
              "Não resuma, não explique e não invente conteúdo.",
              "Retorne somente o texto extraído.",
            ].join("\n"),
          },
          {
            type: "input_file",
            filename: "documento.pdf",
            file_data: fileData,
          },
        ],
      },
    ],
  });

  return sanitizeExtractedText(extractOutputText(response), hardLimit);
}

async function extractByPages(pdf: any): Promise<string> {
  let out = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const strings = (content?.items ?? [])
      .map((item: any) => {
        if (typeof item?.str === "string") return item.str;
        return "";
      })
      .filter(Boolean);

    if (strings.length) {
      out += strings.join(" ") + "\n";
    }
  }

  return out;
}

function normalizeExtractTextResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "";
  }

  const maybeText = (result as { text?: unknown }).text;

  if (typeof maybeText === "string") {
    return maybeText;
  }

  if (Array.isArray(maybeText)) {
    return maybeText
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}

async function extractByUnpdfText(pdf: any): Promise<string> {
  const result = await extractText(pdf, { mergePages: true });
  return normalizeExtractTextResult(result);
}

export async function extractPdfTextFromBuffer(
  buf: Buffer,
  options: ExtractPdfTextOptions = {}
): Promise<PdfExtractResult> {
  const hardLimit = Math.max(1, options.hardLimit ?? DEFAULT_EXTRACT_TEXT_HARD_LIMIT);

  const fileSizeBytes =
    typeof options.fileSizeBytes === "number" && Number.isFinite(options.fileSizeBytes)
      ? options.fileSizeBytes
      : null;

  const maxBytes =
    typeof options.maxBytes === "number" && Number.isFinite(options.maxBytes)
      ? options.maxBytes
      : null;

  if (maxBytes && fileSizeBytes && fileSizeBytes > maxBytes) {
    console.log("[extractPdfTextFromBuffer] skipped_large", {
      fileSizeBytes,
      maxBytes,
    });

    return {
      kind: "skipped_large",
      error: getSkippedLargePdfMessage(options.maxMbLabel ?? null),
    };
  }

  try {
    const pdf = await getDocumentProxy(normalizeBufferInput(buf));

    console.log("[extractPdfTextFromBuffer] pdf loaded", {
      numPages: pdf?.numPages,
      fileSizeBytes,
    });

    // Tentativa 1: leitura por página
    const pageTextRaw = await extractByPages(pdf);
    const pageText = sanitizeExtractedText(pageTextRaw, hardLimit);

    console.log("[extractPdfTextFromBuffer] page extraction", {
      rawLength: pageTextRaw.length,
      finalLength: pageText.length,
      preview: pageText.slice(0, 200),
    });

    // Tentativa 2: fallback do próprio unpdf
    const fallbackRaw = await extractByUnpdfText(pdf);
    const fallbackText = sanitizeExtractedText(fallbackRaw, hardLimit);

    console.log("[extractPdfTextFromBuffer] fallback extraction", {
      rawLength: fallbackRaw.length,
      finalLength: fallbackText.length,
      preview: fallbackText.slice(0, 200),
    });

    const bestNativeText = pageText.length >= fallbackText.length ? pageText : fallbackText;

    if (options.preferOcr && bestNativeText.length >= OCR_MIN_TEXT_LENGTH) {
      const ocrDecision = shouldAttemptOcr(buf);

      if (!ocrDecision.allowed) {
        console.log("[extractPdfTextFromBuffer] preferred OCR skipped", {
          reason: ocrDecision.reason,
        });

        return { kind: "ready", text: bestNativeText };
      }

      try {
        console.log("[extractPdfTextFromBuffer] preferred OCR start", {
          model: OCR_MODEL,
          fileSizeMb: getBufferSizeMb(buf).toFixed(2),
          nativeTextLength: bestNativeText.length,
        });

        const ocrText = await extractByOpenAiOcr(buf, hardLimit);

        console.log("[extractPdfTextFromBuffer] preferred OCR result", {
          finalLength: ocrText.length,
          preview: ocrText.slice(0, 200),
        });

        if (ocrText.trim() && ocrText.length >= Math.floor(bestNativeText.length * 0.6)) {
          return { kind: "ready", text: ocrText };
        }
      } catch (ocrError: any) {
        console.error("[extractPdfTextFromBuffer] preferred OCR technical_error", ocrError);
      }

      return { kind: "ready", text: bestNativeText };
    }

    if (bestNativeText.length >= OCR_MIN_TEXT_LENGTH) {
      return { kind: "ready", text: bestNativeText };
    }

    if (bestNativeText.trim().length > 0) {
      console.log("[extractPdfTextFromBuffer] weak native text, trying OCR", {
        nativeTextLength: bestNativeText.length,
        minTextLength: OCR_MIN_TEXT_LENGTH,
      });
    } else {
      console.log("[extractPdfTextFromBuffer] no_text, trying OCR");
    }

    const ocrDecision = shouldAttemptOcr(buf);

    if (!ocrDecision.allowed) {
      console.log("[extractPdfTextFromBuffer] OCR skipped", {
        reason: ocrDecision.reason,
      });

      if (bestNativeText.trim()) {
        return { kind: "ready", text: bestNativeText };
      }

      return { kind: "no_text" };
    }

    try {
      console.log("[extractPdfTextFromBuffer] OCR start", {
        model: OCR_MODEL,
        fileSizeMb: getBufferSizeMb(buf).toFixed(2),
      });

      const ocrText = await extractByOpenAiOcr(buf, hardLimit);

      console.log("[extractPdfTextFromBuffer] OCR result", {
        finalLength: ocrText.length,
        preview: ocrText.slice(0, 200),
      });

      if (ocrText.trim()) {
        return { kind: "ready", text: ocrText };
      }
    } catch (ocrError: any) {
      console.error("[extractPdfTextFromBuffer] OCR technical_error", ocrError);

      if (bestNativeText.trim()) {
        return { kind: "ready", text: bestNativeText };
      }

      return {
        kind: "technical_error",
        error: `Falha técnica ao executar OCR: ${String(
          ocrError?.message ?? ocrError ?? "erro desconhecido"
        )}`,
      };
    }

    if (bestNativeText.trim()) {
      return { kind: "ready", text: bestNativeText };
    }

    console.log("[extractPdfTextFromBuffer] no_text");

    return { kind: "no_text" };
  } catch (error: any) {
    console.error("[extractPdfTextFromBuffer] technical_error", error);

    return {
      kind: "technical_error",
      error: String(error?.message ?? error ?? "Falha técnica ao extrair texto do PDF."),
    };
  }
}
