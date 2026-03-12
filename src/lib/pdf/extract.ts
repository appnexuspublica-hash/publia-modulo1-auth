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
};

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

    if (pageText) {
      return { kind: "ready", text: pageText };
    }

    // Tentativa 2: fallback do próprio unpdf
    const fallbackRaw = await extractByUnpdfText(pdf);
    const fallbackText = sanitizeExtractedText(fallbackRaw, hardLimit);

    console.log("[extractPdfTextFromBuffer] fallback extraction", {
      rawLength: fallbackRaw.length,
      finalLength: fallbackText.length,
      preview: fallbackText.slice(0, 200),
    });

    if (fallbackText) {
      return { kind: "ready", text: fallbackText };
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