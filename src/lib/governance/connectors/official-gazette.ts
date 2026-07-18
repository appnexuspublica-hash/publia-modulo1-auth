export type DiscoveredOfficialEdition = {
  title: string;
  pdfUrl: string;
};

export interface OfficialSourceConnector {
  discover(sourceUrl: string): Promise<DiscoveredOfficialEdition[]>;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: " ",
};

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const parsed = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : entity;
    }

    if (code.startsWith("#")) {
      const parsed = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : entity;
    }

    return HTML_ENTITIES[code] ?? HTML_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

function decodeHtml(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDiscoveredTitle(label: string, pdfUrl: string) {
  if (label && !/^(acessar|abrir|baixar|download|pdf)$/i.test(label)) {
    return label;
  }

  const fileName = decodeURIComponent(
    new URL(pdfUrl).pathname.split("/").pop() || "",
  )
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return fileName || "Diário Oficial";
}

/**
 * Conector genérico para portais que expõem links diretos para PDFs.
 *
 * A responsabilidade deste conector é somente descobrir URLs.
 * Número da edição e data são lidos do conteúdo do próprio PDF pela camada
 * de metadados, evitando regras específicas para um município.
 */
export class HtmlOfficialGazetteConnector implements OfficialSourceConnector {
  async discover(sourceUrl: string): Promise<DiscoveredOfficialEdition[]> {
    const normalizedSourceUrl = new URL(sourceUrl).toString();

    if (/\.pdf(?:$|[?#])/i.test(normalizedSourceUrl)) {
      return [{
        title: buildDiscoveredTitle("", normalizedSourceUrl),
        pdfUrl: normalizedSourceUrl,
      }];
    }

    const response = await fetch(normalizedSourceUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "Publ.IA/6.1 (+sincronizacao-diario-oficial)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`Portal oficial respondeu com status ${response.status}.`);
    }

    const html = await response.text();
    const editions = new Map<string, DiscoveredOfficialEdition>();
    const anchorPattern =
      /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

    for (const match of html.matchAll(anchorPattern)) {
      const href = decodeHtml(match[2] ?? "");
      if (!href || !/\.pdf(?:$|[?#])/i.test(href)) continue;

      const pdfUrl = new URL(href, normalizedSourceUrl).toString();
      const label = decodeHtml(match[3] ?? "");

      editions.set(pdfUrl, {
        title: buildDiscoveredTitle(label, pdfUrl),
        pdfUrl,
      });
    }

    return [...editions.values()];
  }
}
