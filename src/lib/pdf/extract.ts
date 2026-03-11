// src/lib/pdf/extract.ts
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

export function sanitizeExtractedText(raw: string, hardLimit = DEFAULT_EXTRACT_TEXT_HARD_LIMIT) {
  let text = String(raw ?? "");
  text = text.replace(/\u0000/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n");
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
  if (typeof maxMbLabel === "number" && Number.isFinite(maxMbLabel) && maxMbLabel > 0) {
    return `PDF grande demais para extração automática (${maxMbLabel} MB). Faça OCR/versão menor.`;
  }

  return "PDF grande demais para extração automática. Faça OCR/versão menor.";
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
    return {
      kind: "skipped_large",
      error: getSkippedLargePdfMessage(options.maxMbLabel ?? null),
    };
  }

  try {
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buf),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });

    const doc = await loadingTask.promise;
    let out = "";

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();

      const strings = (content.items ?? [])
        .map((item: any) => (typeof item?.str === "string" ? item.str : ""))
        .filter(Boolean);

      if (strings.length) {
        out += strings.join(" ") + "\n";
      }
    }

    const text = sanitizeExtractedText(out, hardLimit);

    if (!text) {
      return { kind: "no_text" };
    }

    return { kind: "ready", text };
  } catch (error: any) {
    return {
      kind: "technical_error",
      error: String(error?.message ?? error ?? "Falha técnica ao extrair texto do PDF."),
    };
  }
}