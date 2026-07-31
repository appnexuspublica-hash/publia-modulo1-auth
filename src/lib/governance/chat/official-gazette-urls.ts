import type {
  GovernanceChatSource,
  GovernanceChatSources,
} from "@/lib/governance/chat/references";

function isBrokenSupabasePublicStorageUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.hostname.endsWith(".supabase.co") &&
      parsedUrl.pathname.includes("/storage/v1/object/public/governance-documents/")
    );
  } catch {
    return false;
  }
}

export function normalizeOfficialGazetteUrl(
  value: string | null | undefined,
  _publicationDate?: string | null,
) {
  const url = String(value ?? "").trim();

  if (!/^https?:\/\//i.test(url)) {
    return "";
  }

  if (isBrokenSupabasePublicStorageUrl(url)) {
    return "";
  }

  return url;
}

export function pickOfficialGazetteUrl(params: {
  sourcePageUrl?: string | null;
  publicUrl?: string | null;
  pdfUrl?: string | null;
  publicationDate?: string | null;
}) {
  const sourcePageUrl = normalizeOfficialGazetteUrl(
    params.sourcePageUrl,
    params.publicationDate,
  );
  const publicUrl = normalizeOfficialGazetteUrl(params.publicUrl, params.publicationDate);
  const pdfUrl = normalizeOfficialGazetteUrl(params.pdfUrl, params.publicationDate);

  /*
    Preferência:
    1) source_page_url: página oficial da edição, quando cadastrada.
    2) public_url: URL pública consolidada, quando cadastrada.
    3) pdf_url: PDF oficial.
       Se o pdf_url antigo apontar para o Supabase Storage quebrado, ele é convertido
       para o endereço oficial do Diário Oficial municipal.
  */
  return sourcePageUrl || publicUrl || pdfUrl || "";
}

function normalizeGovernanceSourceUrl(value: string | null | undefined) {
  const url = String(value ?? "").trim();

  if (!/^https?:\/\//i.test(url)) {
    return null;
  }

  if (isBrokenSupabasePublicStorageUrl(url)) {
    return null;
  }

  return url;
}

function normalizeGeneralGovernanceSourceUrl(value: string | null | undefined) {
  const url = String(value ?? "").trim();

  if (!/^https?:\/\//i.test(url)) {
    return null;
  }

  return url;
}

export function normalizeGovernanceChatSourcesForResponse(
  sources: GovernanceChatSources,
): GovernanceChatSources {
  const normalizeInstitutionalOrOfficialSource = (
    source: GovernanceChatSource,
  ): GovernanceChatSource => ({
    ...source,
    url: normalizeGeneralGovernanceSourceUrl(source.url),
  });

  const normalizeOfficialGazetteSource = (
    source: GovernanceChatSource,
  ): GovernanceChatSource => ({
    ...source,
    url: normalizeGovernanceSourceUrl(source.url),
  });

  return {
    institutional: sources.institutional.map(normalizeInstitutionalOrOfficialSource),
    officialGazette: sources.officialGazette.map(normalizeOfficialGazetteSource),
    officialSources: sources.officialSources.map(normalizeInstitutionalOrOfficialSource),
  };
}

