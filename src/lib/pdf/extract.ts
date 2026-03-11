// src/lib/pdf/extract.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

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

type ExternalExtractorOkReady = {
  ok: true;
  kind: "ready";
  text: string;
};

type ExternalExtractorOkNoText = {
  ok: true;
  kind: "no_text";
};

type ExternalExtractorError = {
  ok: false;
  error: string;
};

type ExternalExtractorOutput =
  | ExternalExtractorOkReady
  | ExternalExtractorOkNoText
  | ExternalExtractorError;

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

function shouldUseInProcessExtractor() {
  return process.env.VERCEL === "1";
}

async function extractPdfTextInProcess(
  buffer: Buffer,
  hardLimit: number
): Promise<PdfExtractResult> {
  try {
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
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

async function runExternalExtractor(
  tempFilePath: string,
  hardLimit: number
): Promise<ExternalExtractorOutput> {
  const scriptPath = path.join(process.cwd(), "scripts", "extract-pdf.mjs");

  return await new Promise<ExternalExtractorOutput>((resolve) => {
    const child = spawn(process.execPath, [scriptPath, tempFilePath, String(hardLimit)], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    const killTimer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
    }, 45_000);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk ?? "");
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk ?? "");
    });

    child.on("error", (error) => {
      clearTimeout(killTimer);
      resolve({
        ok: false,
        error: String(error?.message ?? error ?? "Falha ao iniciar extrator externo."),
      });
    });

    child.on("close", () => {
      clearTimeout(killTimer);

      const trimmed = stdout.trim();

      if (!trimmed) {
        resolve({
          ok: false,
          error: stderr.trim() || "Extrator externo não retornou saída.",
        });
        return;
      }

      try {
        const parsed = JSON.parse(trimmed) as ExternalExtractorOutput;
        resolve(parsed);
      } catch (error: any) {
        resolve({
          ok: false,
          error:
            `Saída inválida do extrator externo: ${String(error?.message ?? error ?? "")}`.trim() ||
            "Saída inválida do extrator externo.",
        });
      }
    });
  });
}

async function writeBufferToTempPdf(buffer: Buffer): Promise<{
  tempDir: string;
  tempFilePath: string;
}> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "publia-pdf-"));
  const tempFilePath = path.join(tempDir, "input.pdf");

  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  await fs.writeFile(tempFilePath, bytes);

  return { tempDir, tempFilePath };
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

  if (shouldUseInProcessExtractor()) {
    return extractPdfTextInProcess(buf, hardLimit);
  }

  let tempDir = "";
  let tempFilePath = "";

  try {
    const temp = await writeBufferToTempPdf(buf);
    tempDir = temp.tempDir;
    tempFilePath = temp.tempFilePath;

    const result = await runExternalExtractor(tempFilePath, hardLimit);

    if (!result.ok) {
      return {
        kind: "technical_error",
        error: result.error,
      };
    }

    if (result.kind === "no_text") {
      return { kind: "no_text" };
    }

    return {
      kind: "ready",
      text: sanitizeExtractedText(result.text, hardLimit),
    };
  } catch (error: any) {
    return {
      kind: "technical_error",
      error: String(error?.message ?? error ?? "Falha técnica ao extrair texto do PDF."),
    };
  } finally {
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch {}
    }

    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}