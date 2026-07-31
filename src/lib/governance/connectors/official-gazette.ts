import {
  fetchOfficialGazetteHtml,
  isOfficialGazetteUrlAllowedForSource,
  normalizeOfficialGazetteUrlInput,
  OfficialGazetteRemoteAccessError,
} from "@/lib/governance/security/official-gazette-remote-access";

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

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildDiscoveredTitle(label: string, pdfUrl: string) {
  if (label && !/^(acessar|abrir|baixar|download|pdf)$/i.test(label)) {
    return label;
  }

  const fileName = safeDecodeURIComponent(
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
 * A responsabilidade deste conector é descobrir URLs dentro da fronteira de
 * confiança da fonte cadastrada. A camada de acesso remoto valida HTTPS, DNS,
 * IP, porta, redirecionamentos, tamanho e conteúdo antes de ler qualquer dado.
 * Número da edição e data continuam sendo lidos do conteúdo do próprio PDF.
 */
export class HtmlOfficialGazetteConnector implements OfficialSourceConnector {
  async discover(sourceUrl: string): Promise<DiscoveredOfficialEdition[]> {
    const normalizedSourceUrl = normalizeOfficialGazetteUrlInput(sourceUrl);

    if (/\.pdf(?:$|[?#])/i.test(normalizedSourceUrl)) {
      if (
        !isOfficialGazetteUrlAllowedForSource(
          normalizedSourceUrl,
          normalizedSourceUrl,
        )
      ) {
        throw new OfficialGazetteRemoteAccessError(
          "host_not_allowed",
          "A fonte cadastrada aponta para um domínio não autorizado.",
        );
      }

      return [
        {
          title: buildDiscoveredTitle("", normalizedSourceUrl),
          pdfUrl: normalizedSourceUrl,
        },
      ];
    }

    const { html, finalUrl } =
      await fetchOfficialGazetteHtml(normalizedSourceUrl);
    const editions = new Map<string, DiscoveredOfficialEdition>();
    const anchorPattern =
      /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
    let blockedPdfLinks = 0;

    for (const match of html.matchAll(anchorPattern)) {
      const href = decodeHtml(match[2] ?? "");
      if (!href || !/\.pdf(?:$|[?#])/i.test(href)) continue;

      let pdfUrl: string;

      try {
        pdfUrl = new URL(href, finalUrl).toString();
      } catch {
        continue;
      }

      if (!isOfficialGazetteUrlAllowedForSource(pdfUrl, normalizedSourceUrl)) {
        blockedPdfLinks += 1;
        continue;
      }

      const label = decodeHtml(match[3] ?? "");

      editions.set(pdfUrl, {
        title: buildDiscoveredTitle(label, pdfUrl),
        pdfUrl,
      });
    }

    if (editions.size === 0 && blockedPdfLinks > 0) {
      throw new OfficialGazetteRemoteAccessError(
        "host_not_allowed",
        "O portal publicou PDFs em um domínio externo não autorizado. Cadastre esse domínio na lista segura antes de sincronizar.",
      );
    }

    return [...editions.values()];
  }
}
