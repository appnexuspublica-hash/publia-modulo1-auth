// src/lib/governance/officialGazetteCrawler.ts

export type DiscoveredOfficialGazetteEdition = {
  title: string;
  editionNumber: string | null;
  publicationDate: string | null;
  pdfUrl: string;
  sourcePageUrl: string;
};

const PORTUGUESE_MONTHS: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  março: "03",
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

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueByPdfUrl(editions: DiscoveredOfficialGazetteEdition[]) {
  const seen = new Set<string>();
  const result: DiscoveredOfficialGazetteEdition[] = [];

  for (const edition of editions) {
    const key = edition.pdfUrl.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(edition);
  }

  return result;
}

function getAbsoluteUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function getFileNameFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const parts = parsedUrl.pathname.split("/");
    return decodeURIComponent(parts[parts.length - 1] ?? "");
  } catch {
    return url;
  }
}

function inferEditionNumber(value: string) {
  const normalized = normalizeText(value);

  const patterns = [
    /\bedicao\s*(?:n|nº|no|numero)?\s*[:º°-]?\s*(\d{2,8})\b/i,
    /\bed\s*(?:n|nº|no|numero)?\s*[:º°-]?\s*(\d{2,8})\b/i,
    /\bdiario\s*(\d{2,8})\b/i,
    /\b(\d{4,8})\s*diario\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function toIsoDate(day: string, month: string, year: string) {
  const numericDay = Number(day);
  const numericMonth = Number(month);
  const numericYear = Number(year);

  if (
    !Number.isInteger(numericDay) ||
    !Number.isInteger(numericMonth) ||
    !Number.isInteger(numericYear) ||
    numericDay < 1 ||
    numericDay > 31 ||
    numericMonth < 1 ||
    numericMonth > 12 ||
    numericYear < 1900
  ) {
    return null;
  }

  return `${String(numericYear).padStart(4, "0")}-${String(numericMonth).padStart(
    2,
    "0",
  )}-${String(numericDay).padStart(2, "0")}`;
}

function inferPublicationDate(value: string) {
  const normalized = normalizeText(value).toLowerCase();

  const numericDate = normalized.match(
    /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/,
  );

  if (numericDate) {
    return toIsoDate(numericDate[1], numericDate[2], numericDate[3]);
  }

  const isoDate = normalized.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);

  if (isoDate) {
    return toIsoDate(isoDate[3], isoDate[2], isoDate[1]);
  }

  const writtenDate = normalized.match(
    /\b(\d{1,2})\s*(?:de|-)?\s*(janeiro|fevereiro|marco|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:de|-)?\s*(\d{4})\b/i,
  );

  if (writtenDate) {
    const month = PORTUGUESE_MONTHS[writtenDate[2].toLowerCase()];

    if (month) {
      return toIsoDate(writtenDate[1], month, writtenDate[3]);
    }
  }

  const pathDate = normalized.match(
    /\/(\d{4})\/(\d{1,2})\/[^/]*(\d{1,2})(janeiro|fevereiro|marco|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(\d{4})/i,
  );

  if (pathDate) {
    const month = PORTUGUESE_MONTHS[pathDate[4].toLowerCase()];

    if (month) {
      return toIsoDate(pathDate[3], month, pathDate[5]);
    }
  }

  return null;
}

function buildTitle({
  editionNumber,
  publicationDate,
  fallback,
}: {
  editionNumber: string | null;
  publicationDate: string | null;
  fallback: string;
}) {
  if (editionNumber && publicationDate) {
    return `Diário Oficial ${editionNumber} - ${publicationDate}`;
  }

  if (editionNumber) {
    return `Diário Oficial ${editionNumber}`;
  }

  return fallback || "Diário Oficial";
}

function getAnchorCandidates(html: string, sourceUrl: string) {
  const candidates: Array<{ href: string; text: string }> = [];
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const href = match[1] ?? "";
    const text = stripHtml(match[2] ?? "");
    const pdfUrl = getAbsoluteUrl(href, sourceUrl);

    if (!pdfUrl || !/\.pdf(?:[?#].*)?$/i.test(pdfUrl)) {
      continue;
    }

    candidates.push({
      href: pdfUrl,
      text,
    });
  }

  const rawPdfPattern = /(https?:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?)/gi;

  for (const match of html.matchAll(rawPdfPattern)) {
    const href = match[1] ?? "";

    if (!href) {
      continue;
    }

    candidates.push({
      href,
      text: "",
    });
  }

  return candidates;
}

export async function discoverOfficialGazetteEditions(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Publ.IA Governance Official Gazette Sync/1.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Não foi possível acessar a fonte oficial (${response.status}).`);
  }

  const html = await response.text();
  const candidates = getAnchorCandidates(html, sourceUrl);

  const editions = candidates.map((candidate) => {
    const fileName = getFileNameFromUrl(candidate.href);
    const combinedText = `${candidate.text} ${fileName} ${candidate.href}`;
    const editionNumber = inferEditionNumber(combinedText);
    const publicationDate = inferPublicationDate(combinedText);
    const title = buildTitle({
      editionNumber,
      publicationDate,
      fallback: candidate.text || fileName || "Diário Oficial",
    });

    return {
      title,
      editionNumber,
      publicationDate,
      pdfUrl: candidate.href,
      sourcePageUrl: sourceUrl,
    };
  });

  return uniqueByPdfUrl(editions);
}
