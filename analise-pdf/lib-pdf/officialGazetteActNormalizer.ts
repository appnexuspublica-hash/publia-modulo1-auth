// src/lib/pdf/officialGazetteActNormalizer.ts

export type OfficialGazetteActChunkDraft = {
  page_number: number | null;
  section_type: string;
  title: string;
  content: string;
};

type OfficialGazetteActCandidate = {
  start: number;
  end: number;
  header: string;
  title: string;
  sectionType: string;
  canonicalKey: string;
  content: string;
};

type NormalizeOfficialGazetteActsOptions = {
  maxContentLength?: number;
};

const DEFAULT_MAX_CHUNK_CONTENT_LENGTH = 12_000;

function removeDiacritics(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeWhitespace(value: string) {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForCompare(value: string) {
  return removeDiacritics(value)
    .toUpperCase()
    .replace(/N\s*[º°O.]\s*/g, "N ")
    .replace(/[^A-Z0-9/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeActTitle(title: string) {
  return String(title ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/N\s*[º°O.]\s*\.?\s*/gi, "Nº ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+\./g, ".")
    .trim()
    .slice(0, 240);
}

function getSectionTitle(content: string) {
  const firstMeaningfulLine =
    content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "Trecho do Diário Oficial";

  return firstMeaningfulLine.slice(0, 220);
}

function detectSectionType(title: string) {
  const normalizedTitle = normalizeForCompare(title);

  if (normalizedTitle.includes("DECRETO")) return "decreto";
  if (normalizedTitle.includes("PORTARIA")) return "portaria";
  if (normalizedTitle.includes("RESOLUCAO")) return "resolucao";
  if (normalizedTitle.includes("LICITACAO")) return "licitacao";
  if (normalizedTitle.includes("DISPENSA")) return "licitacao";
  if (normalizedTitle.includes("INEXIGIBILIDADE")) return "licitacao";
  if (normalizedTitle.includes("CONTRATO")) return "contrato";
  if (normalizedTitle.includes("ATA")) return "ata";
  if (normalizedTitle.includes("NOMEIA") || normalizedTitle.includes("NOMEACAO")) return "nomeacao";
  if (normalizedTitle.includes("EXONERA") || normalizedTitle.includes("EXONERACAO")) return "exoneracao";
  if (normalizedTitle.includes("EDITAL")) return "edital";
  if (normalizedTitle.includes("AVISO")) return "aviso";
  if (/\bLEI\b/.test(normalizedTitle)) return "lei";

  return "outro";
}

function getOfficialGazetteActHeaderPattern() {
  return new RegExp(
    [
      // Cabeçalhos fortes de atos publicados.
      // Leis entram somente quando aparecem no começo de uma linha,
      // evitando capturar leis apenas citadas como fundamento dentro de outros atos.
      String.raw`(?:^|\n)\s*LEI\s+(?:MUNICIPAL\s+)?N[º°O.]?\s*\.?\s*[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`(?:^|\n)\s*ATA\s+DA\s+ABERTURA[\s\S]{0,320}?DISPENSA\s+DE\s+LICITA[ÇC][ÃA]O\s+[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`(?:^|\n)\s*DECRETO\s+(?:MUNICIPAL\s+)?N[º°O.]?\s*\.?\s*[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`(?:^|\n)\s*PORTARIA\s+N[º°O.]?\s*\.?\s*[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`(?:^|\n)\s*RESOLU[ÇC][ÃA]O\s+(?:N[º°O.]?\s*\.?\s*)?[\d.]+(?:[/-]\d{2,4})?(?:\s+de\s+\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4})?`,
      // Dispensa/Inexigibilidade só são ato próprio quando aparecem como título formal.
      // Se estiverem dentro de uma ATA ("referente à dispensa..."), serão deduplicadas pelo identificador canônico.
      String.raw`\b(?:AVISO|EXTRATO|TERMO)\s+DE\s+DISPENSA\s+DE\s+LICITA[ÇC][ÃA]O\s+[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`\b(?:AVISO|EXTRATO|TERMO)\s+DE\s+INEXIGIBILIDADE\s+DE\s+LICITA[ÇC][ÃA]O\s+[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`(?:^|\n)\s*EXTRATO\s+DE\s+(?:CONTRATO|TERMO|ATA)\s+N[º°O.]?\s*\.?\s*[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`(?:^|\n)\s*EDITAL\s+DE\s+CONVOCA[ÇC][ÃA]O[\s\S]{0,220}?ESTAGI[ÁA]RIOS\s+[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`(?:^|\n)\s*EDITAL\s+N[º°O.]?\s*\.?\s*[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`\bAVISO\s+DE\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ ]{3,80}`,
      String.raw`\bTERMO\s+DE\s+(?:HOMOLOGA[ÇC][ÃA]O|ADJUDICA[ÇC][ÃA]O)[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ Nº°O./-]{0,120}`,
    ].join("|"),
    "gi",
  );
}

function extractNumberAfter(labelPattern: RegExp, value: string) {
  const match = value.match(labelPattern);
  return match?.[1]?.replace(/\s+/g, "") ?? "";
}

function normalizeNumber(value: string) {
  return String(value ?? "")
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .replace(/\/(\d{2})$/, "/20$1");
}

function getCanonicalKey(title: string, content: string) {
  const source = `${title}\n${content}`;
  const normalized = normalizeForCompare(source);

  const dispensaNumber = normalizeNumber(
    extractNumberAfter(/DISPENSA\s+DE\s+LICITA[ÇC][ÃA]O\s+([\d.]+(?:[/-]\d{2,4})?)/i, source),
  );

  const processoNumber = normalizeNumber(
    extractNumberAfter(/PROCESSO\s+(?:ADMINISTRATIVO\s+)?([\d.]+(?:[/-]\d{2,4})?)/i, source),
  );

  if (normalized.includes("ATA DA ABERTURA") && dispensaNumber) {
    return `licitacao:dispensa:${dispensaNumber}`;
  }

  if (dispensaNumber && /(AVISO|EXTRATO|TERMO)\s+DE\s+DISPENSA/.test(normalized)) {
    return `licitacao:dispensa:${dispensaNumber}`;
  }

  if (normalized.includes("INEXIGIBILIDADE")) {
    const inexigibilidadeNumber = normalizeNumber(
      extractNumberAfter(/INEXIGIBILIDADE\s+DE\s+LICITA[ÇC][ÃA]O\s+([\d.]+(?:[/-]\d{2,4})?)/i, source),
    );

    if (inexigibilidadeNumber) {
      return `licitacao:inexigibilidade:${inexigibilidadeNumber}`;
    }
  }

  const decreeNumber = normalizeNumber(
    extractNumberAfter(/DECRETO\s+(?:MUNICIPAL\s+)?N[º°O.]?\s*\.?\s*([\d.]+(?:[/-]\d{2,4})?)/i, source),
  );
  if (decreeNumber) return `decreto:${decreeNumber}`;

  const portariaNumber = normalizeNumber(
    extractNumberAfter(/PORTARIA\s+N[º°O.]?\s*\.?\s*([\d.]+(?:[/-]\d{2,4})?)/i, source),
  );
  if (portariaNumber) return `portaria:${portariaNumber}`;

  const resolucaoNumber = normalizeNumber(
    extractNumberAfter(/RESOLU[ÇC][ÃA]O\s+(?:N[º°O.]?\s*\.?\s*)?([\d.]+(?:[/-]\d{2,4})?)/i, source),
  );
  if (resolucaoNumber) return `resolucao:${resolucaoNumber}`;


  const contratoNumber = normalizeNumber(
    extractNumberAfter(/EXTRATO\s+DE\s+(?:CONTRATO|TERMO|ATA)\s+N[º°O.]?\s*\.?\s*([\d.]+(?:[/-]\d{2,4})?)/i, source),
  );
  if (contratoNumber) return `contrato:${contratoNumber}`;
  const leiNumber = normalizeNumber(
    extractNumberAfter(/LEI\s+(?:MUNICIPAL\s+)?N[º°O.]?\s*\.?\s*([\d.]+(?:[/-]\d{2,4})?)/i, source),
  );
  if (leiNumber) return `lei:${leiNumber}`;

  if (processoNumber) {
    return `processo:${processoNumber}`;
  }

  return `titulo:${normalizeForCompare(title).slice(0, 120)}`;
}

function looksLikePublishedLawAct(content: string) {
  const normalized = normalizeForCompare(content);

  if (!/\bLEI\s+(?:MUNICIPAL\s+)?N\s+[0-9]/.test(normalized)) {
    return false;
  }

  const officialLawMarkers = [
    "SUMULA",
    "FACO SABER",
    "A CAMARA MUNICIPAL",
    "PREFEITO DO MUNICIPIO SANCIONO",
    "PREFEITO MUNICIPAL SANCIONO",
    "SEGUINTE LEI",
    "ESTA LEI ENTRA EM VIGOR",
  ];

  return officialLawMarkers.some((marker) => normalized.includes(marker));
}

function shouldPreferCandidate(next: OfficialGazetteActCandidate, current: OfficialGazetteActCandidate) {
  const nextTitle = normalizeForCompare(next.title);
  const currentTitle = normalizeForCompare(current.title);

  if (nextTitle.includes("ATA DA ABERTURA") && !currentTitle.includes("ATA DA ABERTURA")) {
    return true;
  }

  if (!nextTitle.includes("ATA DA ABERTURA") && currentTitle.includes("ATA DA ABERTURA")) {
    return false;
  }

  if (next.title.length > current.title.length + 20) {
    return true;
  }

  return next.content.length > current.content.length && current.content.length < 600;
}

function mergeUniqueContent(first: string, second: string) {
  const a = normalizeWhitespace(first);
  const b = normalizeWhitespace(second);

  if (!a) return b;
  if (!b) return a;

  const aCompare = normalizeForCompare(a);
  const bCompare = normalizeForCompare(b);

  if (aCompare.includes(bCompare.slice(0, Math.min(200, bCompare.length)))) {
    return a;
  }

  if (bCompare.includes(aCompare.slice(0, Math.min(200, aCompare.length)))) {
    return b;
  }

  return `${a}\n\n${b}`;
}

function splitLongContent(content: string, maxContentLength: number) {
  const normalizedContent = normalizeWhitespace(content);

  if (normalizedContent.length <= maxContentLength) {
    return [normalizedContent];
  }

  const parts: string[] = [];
  let remaining = normalizedContent;

  while (remaining.length > maxContentLength) {
    const slice = remaining.slice(0, maxContentLength);
    const lastBreak = Math.max(
      slice.lastIndexOf("\n\n"),
      slice.lastIndexOf(". "),
      slice.lastIndexOf("; "),
    );

    const cutAt =
      lastBreak > Math.floor(maxContentLength * 0.55)
        ? lastBreak + 1
        : maxContentLength;

    parts.push(remaining.slice(0, cutAt).trim());
    remaining = remaining.slice(cutAt).trim();
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts;
}

export function normalizeOfficialGazetteActs(
  rawText: string,
  options: NormalizeOfficialGazetteActsOptions = {},
): OfficialGazetteActChunkDraft[] {
  const text = normalizeWhitespace(rawText);
  const maxContentLength = options.maxContentLength ?? DEFAULT_MAX_CHUNK_CONTENT_LENGTH;

  if (!text) {
    return [];
  }

  const headerPattern = getOfficialGazetteActHeaderPattern();
  const matches = Array.from(text.matchAll(headerPattern))
    .filter((match) => typeof match.index === "number")
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  if (matches.length === 0) {
    return splitLongContent(text, maxContentLength).map((content, index) => ({
      page_number: null,
      section_type: "outro",
      title: index === 0 ? getSectionTitle(content) : `${getSectionTitle(content)} — parte ${index + 1}`,
      content,
    }));
  }

  const candidates: OfficialGazetteActCandidate[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0;
    const end =
      index + 1 < matches.length
        ? matches[index + 1].index ?? text.length
        : text.length;

    const content = text.slice(start, end).trim();

    if (!content) {
      continue;
    }

    const header = normalizeActTitle(String(matches[index][0] ?? ""));
    const title = header || getSectionTitle(content);
    const sectionType = detectSectionType(title);

    if (sectionType === "lei" && !looksLikePublishedLawAct(content)) {
      continue;
    }

    const canonicalKey = getCanonicalKey(title, content);

    candidates.push({
      start,
      end,
      header,
      title,
      sectionType,
      canonicalKey,
      content,
    });
  }

  const byCanonicalKey = new Map<string, OfficialGazetteActCandidate>();

  for (const candidate of candidates) {
    const existing = byCanonicalKey.get(candidate.canonicalKey);

    if (!existing) {
      byCanonicalKey.set(candidate.canonicalKey, candidate);
      continue;
    }

    const mergedContent = mergeUniqueContent(existing.content, candidate.content);

    if (shouldPreferCandidate(candidate, existing)) {
      byCanonicalKey.set(candidate.canonicalKey, {
        ...candidate,
        start: Math.min(existing.start, candidate.start),
        end: Math.max(existing.end, candidate.end),
        content: mergedContent,
      });
    } else {
      byCanonicalKey.set(candidate.canonicalKey, {
        ...existing,
        start: Math.min(existing.start, candidate.start),
        end: Math.max(existing.end, candidate.end),
        content: mergedContent,
      });
    }
  }

  const normalizedActs = Array.from(byCanonicalKey.values()).sort((a, b) => a.start - b.start);
  const chunks: OfficialGazetteActChunkDraft[] = [];

  for (const act of normalizedActs) {
    splitLongContent(act.content, maxContentLength).forEach((contentPart, partIndex) => {
      chunks.push({
        page_number: null,
        section_type: act.sectionType,
        title: partIndex === 0 ? act.title : `${act.title} — parte ${partIndex + 1}`,
        content: contentPart,
      });
    });
  }

  return chunks;
}
