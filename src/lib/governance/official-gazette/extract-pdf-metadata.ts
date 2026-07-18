import { getDocumentProxy } from "unpdf";

export type OfficialGazettePdfMetadata = {
  editionNumber: string | null;
  publicationDate: string | null;
};

const MAX_METADATA_PAGES = 3;

function normalizeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "o")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEditionNumber(value: string | null) {
  const normalized = value?.trim().replace(/[^\d./-]/g, "") ?? "";
  return normalized || null;
}

function normalizeDate(value: string | null) {
  if (!value) return null;

  const isoMatch = value.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  const brMatch = value.match(/\b(\d{1,2})[/. -](\d{1,2})[/. -](20\d{2})\b/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }

  const monthNames: Record<string, string> = {
    janeiro: "01",
    fevereiro: "02",
    marco: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };

  const longDateMatch = normalizeText(value).match(
    /\b(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de)?\s+(20\d{2})\b/i,
  );

  if (!longDateMatch) return null;

  return `${longDateMatch[3]}-${monthNames[longDateMatch[2].toLowerCase()]}-${longDateMatch[1].padStart(2, "0")}`;
}

function extractEditionNumber(text: string) {
  const normalized = normalizeText(text);
  const patterns = [
    /\bedicao\s*(?:n(?:o)?[.\s:]*)?([0-9][0-9./-]*)\b/i,
    /\bnumero\s+da\s+edicao\s*[:.\s]*([0-9][0-9./-]*)\b/i,
    /\bdiario\s+oficial\s*(?:n(?:o)?[.\s:]*)?([0-9][0-9./-]*)\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const editionNumber = normalizeEditionNumber(match?.[1] ?? null);

    if (editionNumber) return editionNumber;
  }

  return null;
}

function extractEditionDate(text: string) {
  const normalized = normalizeText(text);

  const explicitPatterns = [
    /\bdata\s+da\s+edicao\s*[:.\s-]*([^\n|]{0,45})/i,
    /\bdata\s*[:.\s-]*([^\n|]{0,45})/i,
    /\bedicao\s+de\s+([^\n|]{0,45})/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = normalized.match(pattern);
    const editionDate = normalizeDate(match?.[1] ?? null);

    if (editionDate) return editionDate;
  }

  const editionPatterns = [
    /\bedicao\s*(?:n(?:o)?[.\s:]*)?([0-9][0-9./-]*)\b/i,
    /\bnumero\s+da\s+edicao\s*[:.\s]*([0-9][0-9./-]*)\b/i,
    /\bdiario\s+oficial\s*(?:n(?:o)?[.\s:]*)?([0-9][0-9./-]*)\b/i,
  ];

  let editionIndex = -1;

  for (const pattern of editionPatterns) {
    const match = pattern.exec(normalized);

    if (match?.index !== undefined) {
      editionIndex = match.index;
      break;
    }
  }

  if (editionIndex < 0) {
    return null;
  }

  const contextStart = Math.max(0, editionIndex - 220);
  const contextEnd = Math.min(normalized.length, editionIndex + 320);
  const context = normalized.slice(contextStart, contextEnd);

  const candidates: Array<{ value: string; distance: number }> = [];
  const numericDatePattern =
    /\b(?:\d{1,2}[/. -]\d{1,2}[/. -]20\d{2}|20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b/g;

  for (const match of context.matchAll(numericDatePattern)) {
    const value = normalizeDate(match[0]);

    if (value) {
      const absoluteIndex = contextStart + (match.index ?? 0);
      candidates.push({
        value,
        distance: Math.abs(absoluteIndex - editionIndex),
      });
    }
  }

  const longDatePattern =
    /\b\d{1,2}\s+de\s+(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de)?\s+20\d{2}\b/gi;

  for (const match of context.matchAll(longDatePattern)) {
    const value = normalizeDate(match[0]);

    if (value) {
      const absoluteIndex = contextStart + (match.index ?? 0);
      candidates.push({
        value,
        distance: Math.abs(absoluteIndex - editionIndex),
      });
    }
  }

  candidates.sort((firstCandidate, secondCandidate) => {
    return firstCandidate.distance - secondCandidate.distance;
  });

  return candidates[0]?.value ?? null;
}

async function extractFirstPagesText(fileBuffer: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(fileBuffer));
  const pageLimit = Math.min(pdf.numPages ?? 0, MAX_METADATA_PAGES);
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const text = (content?.items ?? [])
      .map((item) =>
        "str" in item && typeof item.str === "string" ? item.str : "",
      )
      .filter(Boolean)
      .join(" ");

    if (text.trim()) pages.push(text);
  }

  return pages.join("\n");
}

/**
 * Faz uma leitura leve das primeiras páginas do PDF.
 *
 * Não executa OCR e não indexa o documento. O pipeline estabilizado continua
 * responsável pelo processamento completo. Quando o cabeçalho for imagem,
 * os metadados permanecem pendentes em vez de serem presumidos.
 */
export async function extractOfficialGazetteMetadataFromPdfBuffer(
  fileBuffer: Buffer,
): Promise<OfficialGazettePdfMetadata> {
  try {
    const text = await extractFirstPagesText(fileBuffer);

    if (!text.trim()) {
      return {
        editionNumber: null,
        publicationDate: null,
      };
    }

    return {
      editionNumber: extractEditionNumber(text),
      publicationDate: extractEditionDate(text),
    };
  } catch (error) {
    console.error(
      "[governance] Não foi possível ler metadados do PDF do Diário Oficial:",
      error,
    );

    return {
      editionNumber: null,
      publicationDate: null,
    };
  }
}
