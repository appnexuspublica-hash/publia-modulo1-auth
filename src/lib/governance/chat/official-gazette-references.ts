import {
  normalizeOfficialGazetteUrl,
  pickOfficialGazetteUrl,
} from "@/lib/governance/chat/official-gazette-urls";

export type OfficialGazetteReferenceLink = {
  label: string;
  url: string;
  title: string;
  editionNumber: number | null;
  publicationDate: string | null;
};

type OfficialGazetteReferenceChunk = {
  title?: string | null;
  content?: string | null;
  governance_official_gazette_documents?:
    | {
        edition_number?: number | null;
        publication_date?: string | null;
        public_url?: string | null;
        pdf_url?: string | null;
        source_page_url?: string | null;
      }
    | {
        edition_number?: number | null;
        publication_date?: string | null;
        public_url?: string | null;
        pdf_url?: string | null;
        source_page_url?: string | null;
      }[]
    | null;
};

function escapeRegExp(value: string) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeOfficialGazetteLabel(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*,.*$/g, "")
    .trim();
}

function extractOfficialGazetteLegalLabels(value: string) {
  const text = String(value ?? "");
  const pattern =
    /\b(?:Lei(?:\s+Complementar)?|Decreto|Portaria|Instrução Normativa|Resolução|Edital|Dispensa|Inexigibilidade)\s+n[º°]?\s*[\d.]+\/\d{4}\b/gi;

  const labels = new Set<string>();

  for (const match of text.matchAll(pattern)) {
    const label = normalizeOfficialGazetteLabel(match[0]);

    if (label) {
      labels.add(label);
    }
  }

  return Array.from(labels);
}

function getOfficialGazetteDocumentMetadata(
  chunk: OfficialGazetteReferenceChunk,
) {
  const relation = chunk.governance_official_gazette_documents;
  const documentMetadata = Array.isArray(relation) ? relation[0] : relation;

  return {
    editionNumber: documentMetadata?.edition_number ?? null,
    publicationDate: documentMetadata?.publication_date ?? null,
    publicUrl: String(documentMetadata?.public_url ?? "").trim(),
    pdfUrl: String(documentMetadata?.pdf_url ?? "").trim(),
    sourcePageUrl: String(documentMetadata?.source_page_url ?? "").trim(),
  };
}

export function buildOfficialGazetteReferenceLinks(
  chunks: OfficialGazetteReferenceChunk[],
) {
  const linksByKey = new Map<string, OfficialGazetteReferenceLink>();

  for (const chunk of chunks) {
    const title = String(chunk.title ?? "Ato do Diário Oficial").trim();
    const content = String(chunk.content ?? "");
    const { editionNumber, publicationDate, publicUrl, pdfUrl, sourcePageUrl } =
      getOfficialGazetteDocumentMetadata(chunk);
    const officialUrl = pickOfficialGazetteUrl({
      sourcePageUrl,
      publicUrl,
      pdfUrl,
      publicationDate,
    });

    if (!officialUrl) {
      continue;
    }

    const labels = [
      ...extractOfficialGazetteLegalLabels(title),
      ...extractOfficialGazetteLegalLabels(content).slice(0, 8),
    ];

    for (const label of labels) {
      const key = label.toLocaleLowerCase("pt-BR");

      if (!linksByKey.has(key)) {
        linksByKey.set(key, {
          label,
          url: officialUrl,
          title,
          editionNumber,
          publicationDate,
        });
      }
    }
  }

  return Array.from(linksByKey.values());
}

export function linkOfficialGazetteReferencesInAssistantText(
  content: string,
  referenceLinks: OfficialGazetteReferenceLink[],
) {
  let nextContent = String(content ?? "");

  for (const referenceLink of referenceLinks) {
    const label = normalizeOfficialGazetteLabel(referenceLink.label);
    const url = normalizeOfficialGazetteUrl(
      referenceLink.url,
      referenceLink.publicationDate,
    );

    if (!label || !url) {
      continue;
    }

    const pattern = new RegExp(`\\b${escapeRegExp(label)}\\b`, "gi");

    nextContent = nextContent.replace(
      pattern,
      (match, offset: number, fullText: string) => {
        const before = fullText.slice(Math.max(0, offset - 2), offset);
        const after = fullText.slice(offset + match.length, offset + match.length + 2);

        if (before.includes("[") || after.startsWith("](")) {
          return match;
        }

        return `[${match}](${url})`;
      },
    );
  }

  return nextContent;
}
