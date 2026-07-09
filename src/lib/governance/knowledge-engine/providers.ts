import { scoreGovernanceKnowledgeItem } from "./scorer";
import type { GovernanceKnowledgeItem, GovernanceKnowledgeScoreResult } from "./types";

const MAX_INSTITUTIONAL_ROWS = 80;
const MAX_GAZETTE_ROWS = 250;
const MAX_OFFICIAL_SOURCES_ROWS = 80;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function getSupabasePublicUrl(bucket: unknown, path: unknown) {
  const supabaseUrl = cleanText(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  const cleanBucket = cleanText(bucket);
  const cleanPath = cleanText(path).replace(/^\/+/, "");

  if (!supabaseUrl || !cleanBucket || !cleanPath) {
    return null;
  }

  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${encodeURIComponent(cleanBucket)}/${cleanPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

async function createInstitutionalStorageUrl(params: {
  client: any;
  storageBucket: unknown;
  storagePath: unknown;
}) {
  const storageBucket = cleanText(params.storageBucket);
  const storagePath = cleanText(params.storagePath).replace(/^\/+/, "");

  if (!storageBucket || !storagePath) {
    return null;
  }

  const { data: signedUrlData, error: signedUrlError } = await params.client.storage
    .from(storageBucket)
    .createSignedUrl(storagePath, 60 * 60 * 24);

  const signedUrl = cleanText(signedUrlData?.signedUrl);

  if (!signedUrlError && signedUrl) {
    return signedUrl;
  }

  const publicUrlData = params.client.storage
    .from(storageBucket)
    .getPublicUrl(storagePath);

  const publicUrl = cleanText(publicUrlData?.data?.publicUrl);

  if (publicUrl) {
    return publicUrl;
  }

  console.warn("[governance/knowledge-engine] Não foi possível resolver URL do Storage institucional:", {
    storageBucket,
    storagePath,
    error: signedUrlError?.message ?? null,
  });

  return getSupabasePublicUrl(storageBucket, storagePath);
}

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
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

function isBrokenSupabaseGovernanceStorageUrl(url: string) {
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

function normalizeOfficialGazetteFileName(fileName: string) {
  return cleanText(fileName)
    .replace(/^\d{10,}-/, "")
    .replace(/-d4sign\.pdf$/i, "-D4Sign.pdf");
}

function inferOfficialGazetteYearMonthFromFileName(fileName: string) {
  const normalized = cleanText(fileName)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const numericDateMatch = normalized.match(/(?:^|[^0-9])(\d{1,2})[-_]?(\d{1,2})[-_]?(\d{4})(?:[^0-9]|$)/);

  if (numericDateMatch) {
    return {
      year: numericDateMatch[3],
      month: numericDateMatch[2].padStart(2, "0"),
    };
  }

  for (const [monthName, month] of Object.entries(MONTH_NAME_TO_NUMBER)) {
    const plainMonthName = monthName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const monthYearMatch = normalized.match(new RegExp(`${plainMonthName}\\D*(20\\d{2})`));

    if (monthYearMatch) {
      return {
        year: monthYearMatch[1],
        month,
      };
    }
  }

  return null;
}

function convertBrokenSupabaseOfficialGazetteUrl(url: string) {
  if (!isBrokenSupabaseGovernanceStorageUrl(url)) {
    return url;
  }

  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    const rawFileName = decodeURIComponent(pathParts[pathParts.length - 1] ?? "");
    const fileName = normalizeOfficialGazetteFileName(rawFileName);

    if (!fileName || !/\.pdf$/i.test(fileName)) {
      return "";
    }

    const yearMonth = inferOfficialGazetteYearMonthFromFileName(fileName);

    if (!yearMonth) {
      return "";
    }

    return `https://santanadoitarare.pr.gov.br/diariooficial/wp-content/uploads/${yearMonth.year}/${yearMonth.month}/${encodeURIComponent(fileName).replace(/%2F/g, "/")}`;
  } catch {
    return "";
  }
}

function normalizeSourceUrl(value: unknown) {
  const url = cleanText(value);

  if (!url || !/^https?:\/\//i.test(url)) {
    return null;
  }

  const converted = convertBrokenSupabaseOfficialGazetteUrl(url);
  return converted || null;
}

function excerptAroundBestEvidence(text: string, question: string, maxLength = 1800) {
  const clean = cleanText(text);

  if (clean.length <= maxLength) {
    return clean;
  }

  const terms = question
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 4);

  const lower = clean
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const firstMatch = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  const start = Math.max(0, (firstMatch ?? 0) - 350);
  return clean.slice(start, start + maxLength).trim();
}

function firstObject<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildScoringMetadata(scored: GovernanceKnowledgeScoreResult, extra?: Record<string, unknown>) {
  return {
    ...(extra ?? {}),
    confidence: scored.confidence,
    scoring_topic: scored.topic,
    relevance: scored.relevance,
  };
}

async function resolveInstitutionalUrl(params: { client: any; row: any }) {
  const officialUrl = normalizeSourceUrl(params.row.source_url);

  if (officialUrl) {
    return officialUrl;
  }

  return createInstitutionalStorageUrl({
    client: params.client,
    storageBucket: params.row.storage_bucket,
    storagePath: params.row.storage_path,
  });
}

export async function loadInstitutionalKnowledgeItems(params: {
  client: any;
  organizationId: string;
  question: string;
}): Promise<GovernanceKnowledgeItem[]> {
  const { data, error } = await params.client
    .from("institutional_documents")
    .select(
      "id,title,document_type,source_url,storage_bucket,storage_path,extracted_text,indexing_status,review_status,indexed_at,updated_at",
    )
    .eq("organization_id", params.organizationId)
    .not("extracted_text", "is", null)
    .order("updated_at", { ascending: false })
    .limit(MAX_INSTITUTIONAL_ROWS);

  if (error) {
    console.warn("[governance/knowledge-engine] Falha ao carregar Base Institucional:", error);
    return [];
  }

  const rows = ((data ?? []) as any[]).filter((row) => {
    const text = cleanText(row.extracted_text);
    const indexingStatus = cleanText(row.indexing_status).toLowerCase();
    const reviewStatus = cleanText(row.review_status).toLowerCase();

    if (text.length < 40) return false;
    if (indexingStatus && !["indexed", "processed", "ready", "ok"].includes(indexingStatus)) return false;
    if (reviewStatus && !["approved", "aprovado", "reviewed", "validado"].includes(reviewStatus)) return false;
    return true;
  });

  return Promise.all(
    rows.map(async (row) => {
      const title = cleanText(row.title) || "Documento institucional";
      const type = cleanText(row.document_type) || "documento institucional";
      const body = cleanText(row.extracted_text);
      const url = await resolveInstitutionalUrl({ client: params.client, row });

      const scored = scoreGovernanceKnowledgeItem({
        question: params.question,
        provider: "institutional",
        title,
        body,
        type,
        url,
        recencyDate: row.updated_at ?? row.indexed_at ?? null,
      });

      return {
        id: String(row.id),
        provider: "institutional" as const,
        title,
        type,
        url,
        score: scored.score,
        evidence: scored.evidence,
        excerpt: excerptAroundBestEvidence(body, params.question, 2200),
        metadata: buildScoringMetadata(scored, {
          indexing_status: row.indexing_status ?? null,
          review_status: row.review_status ?? null,
          recency_date: row.updated_at ?? row.indexed_at ?? null,
          storage_bucket: row.storage_bucket ?? null,
          storage_path: row.storage_path ?? null,
          source_url: row.source_url ?? null,
        }),
      };
    }),
  );
}

export async function loadOfficialGazetteKnowledgeItems(params: {
  client: any;
  organizationId: string;
  question: string;
}): Promise<GovernanceKnowledgeItem[]> {
  const { data, error } = await params.client
    .from("governance_official_gazette_chunks")
    .select(
      `
        document_id,
        organization_id,
        page_number,
        section_type,
        title,
        content,
        governance_official_gazette_documents(
          edition_number,
          publication_date,
          public_url,
          pdf_url,
          source_page_url
        )
      `,
    )
    .eq("organization_id", params.organizationId)
    .order("document_id", { ascending: false })
    .order("page_number", { ascending: true, nullsFirst: false })
    .limit(MAX_GAZETTE_ROWS);

  if (error) {
    console.warn("[governance/knowledge-engine] Falha ao carregar Diário Oficial:", error);
    return [];
  }

  return ((data ?? []) as any[])
    .filter((row) => cleanText(row.content).length >= 40)
    .map((row, index) => {
      const doc = firstObject(row.governance_official_gazette_documents);
      const title = cleanText(row.title) || `Diário Oficial${doc?.edition_number ? ` nº ${doc.edition_number}` : ""}`;
      const type = cleanText(row.section_type) || "diário oficial";
      const body = cleanText(row.content);
      const url =
        normalizeSourceUrl(doc?.public_url) ||
        normalizeSourceUrl(doc?.pdf_url) ||
        normalizeSourceUrl(doc?.source_page_url) ||
        null;

      const scored = scoreGovernanceKnowledgeItem({
        question: params.question,
        provider: "official_gazette",
        title,
        body,
        type,
        url,
        recencyDate: doc?.publication_date ?? null,
      });

      return {
        id: `${String(row.document_id)}:${row.page_number ?? index}`,
        provider: "official_gazette" as const,
        title,
        type,
        url,
        score: scored.score,
        evidence: scored.evidence,
        excerpt: excerptAroundBestEvidence(body, params.question, 1600),
        metadata: buildScoringMetadata(scored, {
          document_id: row.document_id,
          page_number: row.page_number ?? null,
          edition_number: doc?.edition_number ?? null,
          publication_date: doc?.publication_date ?? null,
          recency_date: doc?.publication_date ?? null,
        }),
      };
    });
}

export async function loadOfficialSourcesKnowledgeItems(params: {
  client: any;
  organizationId: string;
  question: string;
}): Promise<GovernanceKnowledgeItem[]> {
  const { data, error } = await params.client
    .from("official_sources")
    .select("id,organization_id,name,source_type,url,notes,status,priority,reviewed_at")
    .eq("organization_id", params.organizationId)
    .eq("status", "active")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .limit(MAX_OFFICIAL_SOURCES_ROWS);

  if (error) {
    console.warn("[governance/knowledge-engine] Falha ao carregar Fontes Oficiais:", error);
    return [];
  }

  return ((data ?? []) as any[])
    .filter((row) => cleanText(row.name).length > 0 && cleanText(row.url).length > 0)
    .map((row) => {
      const title = cleanText(row.name);
      const type = cleanText(row.source_type) || "fonte oficial";
      const body = [row.name, row.source_type, row.notes, row.priority].map(cleanText).filter(Boolean).join(" | ");

      const scored = scoreGovernanceKnowledgeItem({
        question: params.question,
        provider: "official_sources",
        title,
        body,
        type,
        url: normalizeSourceUrl(row.url),
        recencyDate: row.reviewed_at ?? null,
      });

      return {
        id: String(row.id),
        provider: "official_sources" as const,
        title,
        type,
        url: normalizeSourceUrl(row.url),
        score: scored.score,
        evidence: scored.evidence,
        excerpt: body,
        metadata: buildScoringMetadata(scored, {
          priority: row.priority ?? null,
          reviewed_at: row.reviewed_at ?? null,
          recency_date: row.reviewed_at ?? null,
        }),
      };
    });
}
