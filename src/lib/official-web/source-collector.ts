export type OfficialWebSource = {
  title: string;
  url: string;
};

type CollectOfficialWebSourcesOptions = {
  allowedDomains?: string[];
  maxItems?: number;
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function isAllowedOfficialUrl(url: string, allowedDomains: string[]) {
  try {
    const hostname = normalizeHost(new URL(url).hostname);

    if (allowedDomains.length === 0) {
      return hostname.endsWith(".gov.br") || hostname.endsWith(".jus.br");
    }

    return allowedDomains.some((domain) => {
      const normalizedDomain = normalizeHost(domain);
      return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
    });
  } catch {
    return false;
  }
}

function inferTitle(value: Record<string, unknown>, url: string) {
  const directTitle =
    cleanText(value.title) ||
    cleanText(value.name) ||
    cleanText(value.page_title) ||
    cleanText(value.site_name);

  if (directTitle) {
    return directTitle;
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Fonte oficial consultada";
  }
}

export function collectOfficialWebSources(
  payload: unknown,
  options: CollectOfficialWebSourcesOptions = {},
): OfficialWebSource[] {
  const allowedDomains = (options.allowedDomains ?? []).map(normalizeHost);
  const maxItems = Math.max(1, Math.min(12, options.maxItems ?? 8));
  const sources = new Map<string, OfficialWebSource>();
  const visited = new Set<object>();

  function addSource(candidate: Record<string, unknown>) {
    const url =
      cleanText(candidate.url) ||
      cleanText(candidate.uri) ||
      cleanText(candidate.link);

    if (!url || !/^https?:\/\//i.test(url)) {
      return;
    }

    if (!isAllowedOfficialUrl(url, allowedDomains)) {
      return;
    }

    let normalizedUrl = url;
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      normalizedUrl = parsed.toString();
    } catch {
      return;
    }

    const key = normalizedUrl.toLowerCase();
    const incoming = {
      title: inferTitle(candidate, normalizedUrl),
      url: normalizedUrl,
    };
    const existing = sources.get(key);

    if (!existing || incoming.title.length > existing.title.length) {
      sources.set(key, incoming);
    }
  }

  function visit(value: unknown) {
    if (sources.size >= maxItems || value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
        if (sources.size >= maxItems) break;
      }
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    const objectValue = value as Record<string, unknown>;
    if (visited.has(objectValue)) {
      return;
    }
    visited.add(objectValue);

    addSource(objectValue);

    for (const nestedValue of Object.values(objectValue)) {
      visit(nestedValue);
      if (sources.size >= maxItems) break;
    }
  }

  visit(payload);

  return Array.from(sources.values()).slice(0, maxItems);
}

type CollectOfficialWebSourcesFromTextOptions = CollectOfficialWebSourcesOptions;

function decodeMarkdownLabel(value: string) {
  return cleanText(
    value
      .replace(/[*_`]/g, "")
      .replace(/\\([()[\]])/g, "$1"),
  );
}

function isGenericLinkLabel(label: string, url: string) {
  const normalizedLabel = normalizeHost(
    label
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, ""),
  );

  try {
    const hostname = normalizeHost(new URL(url).hostname);
    return (
      !label ||
      normalizedLabel === hostname ||
      normalizedLabel === "gov.br" ||
      normalizedLabel.endsWith(".gov.br") ||
      normalizedLabel.endsWith(".jus.br")
    );
  } catch {
    return !label;
  }
}

function inferContextualOfficialTitle(
  text: string,
  matchIndex: number,
  label: string,
  url: string,
) {
  const cleanLabel = decodeMarkdownLabel(label);

  if (!isGenericLinkLabel(cleanLabel, url) && cleanLabel.length >= 8) {
    return cleanLabel;
  }

  const before = text.slice(Math.max(0, matchIndex - 420), matchIndex);
  const candidates: string[] = [];

  const patterns = [
    /\bAc[oó]rd[aã]o\s+n?[º°]?\s*\d{1,6}\/\d{4}(?:\s*[-–—]\s*(?:TCU[-\s]*)?(?:Plen[aá]rio|\d[ªa]\s*C[aâ]mara))?/gi,
    /\bInstru[cç][aã]o\s+Normativa(?:\s+(?:SEGES|Seges)(?:\/(?:ME|MGI))?)?\s+n?[º°]?\s*\d+\/\d{4}/gi,
    /\bDecreto(?:\s+Federal)?\s+n?[º°]?\s*\d[\d.]*\/\d{4}/gi,
    /\bLei(?:\s+Complementar)?\s+n?[º°]?\s*\d[\d.]*\/\d{4}/gi,
    /\bGuia\s+de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^.!?\n]{8,140}/g,
    /\bSistema\s+de\s+Transpar[eê]ncia\s+Ativa\s*\(STA\)/gi,
    /\bEscala\s+Brasil\s+Transparente(?:\s*[-–—]\s*Avalia[cç][aã]o\s*360[º°])?/gi,
  ];

  for (const pattern of patterns) {
    const matches = Array.from(before.matchAll(pattern));
    const last = matches.at(-1)?.[0];
    if (last) candidates.push(cleanText(last));
  }

  const boldMatches = Array.from(before.matchAll(/\*\*([^*\n]{8,160})\*\*/g));
  const lastBold = boldMatches.at(-1)?.[1];
  if (lastBold) candidates.push(cleanText(lastBold));

  const best = candidates
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0];

  if (best) {
    return best;
  }

  return cleanLabel || inferTitle({}, url);
}

export function collectOfficialWebSourcesFromText(
  text: string,
  options: CollectOfficialWebSourcesFromTextOptions = {},
): OfficialWebSource[] {
  const allowedDomains = (options.allowedDomains ?? []).map(normalizeHost);
  const maxItems = Math.max(1, Math.min(12, options.maxItems ?? 8));
  const sources = new Map<string, OfficialWebSource>();
  const content = String(text ?? "");

  function add(urlValue: string, label: string, index: number) {
    const url = cleanText(urlValue);
    if (!/^https?:\/\//i.test(url) || !isAllowedOfficialUrl(url, allowedDomains)) {
      return;
    }

    let normalizedUrl = url;
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      normalizedUrl = parsed.toString();
    } catch {
      return;
    }

    const incoming: OfficialWebSource = {
      title: inferContextualOfficialTitle(content, index, label, normalizedUrl),
      url: normalizedUrl,
    };
    const key = normalizedUrl.toLowerCase();
    const existing = sources.get(key);

    if (!existing || incoming.title.length > existing.title.length) {
      sources.set(key, incoming);
    }
  }

  for (const match of content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi)) {
    add(match[2], match[1], match.index ?? 0);
    if (sources.size >= maxItems) break;
  }

  if (sources.size < maxItems) {
    for (const match of content.matchAll(/(?<!\]\()https?:\/\/[^\s<>)]+/gi)) {
      add(match[0].replace(/[.,;:!?]+$/, ""), "", match.index ?? 0);
      if (sources.size >= maxItems) break;
    }
  }

  return Array.from(sources.values()).slice(0, maxItems);
}

