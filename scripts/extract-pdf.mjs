// scripts/extract-pdf.mjs
import fs from "node:fs/promises";

const DEFAULT_HARD_LIMIT = 250_000;

function sanitizeExtractedText(raw, hardLimit = DEFAULT_HARD_LIMIT) {
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

async function extractWithPdfJsDist(filePath, hardLimit = DEFAULT_HARD_LIMIT) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const fileBuffer = await fs.readFile(filePath);

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(fileBuffer),
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
      .map((item) => (typeof item?.str === "string" ? item.str : ""))
      .filter(Boolean);

    if (strings.length) {
      out += strings.join(" ") + "\n";
    }
  }

  return sanitizeExtractedText(out, hardLimit);
}

async function main() {
  const [, , filePath, hardLimitArg] = process.argv;

  if (!filePath) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: "FILE_PATH ausente.",
      })
    );
    process.exit(1);
    return;
  }

  const hardLimit = Number(hardLimitArg ?? DEFAULT_HARD_LIMIT);
  const finalHardLimit =
    Number.isFinite(hardLimit) && hardLimit > 0 ? hardLimit : DEFAULT_HARD_LIMIT;

  try {
    const text = await extractWithPdfJsDist(filePath, finalHardLimit);

    if (!text || !text.trim()) {
      process.stdout.write(
        JSON.stringify({
          ok: true,
          kind: "no_text",
        })
      );
      process.exit(0);
      return;
    }

    process.stdout.write(
      JSON.stringify({
        ok: true,
        kind: "ready",
        text,
      })
    );
    process.exit(0);
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: String(error?.message ?? error ?? "Falha técnica ao extrair PDF."),
      })
    );
    process.exit(1);
  }
}

main();