import { analyzeGovernanceQuery } from "@/lib/governance/knowledge-engine/analyzer";
import { getGovernanceLegalCatalogForQuery } from "@/lib/governance/knowledge-engine/legal-catalog";
import { normalizeRecoveryText, scoreLexicalEvidence } from "./normalize";
import type { GovernanceRecoveryEvidence } from "./types";

function confidence(score: number) {
  return Math.max(0, Math.min(1, score / 80));
}

function structuredActReference(question: string) {
  const q = normalizeRecoveryText(question);
  const match = q.match(/\b(decreto|portaria|resolucao|lei|edital|contrato)\s+(?:n\s*)?0*(\d{1,8})(?:[./-](\d{2,4}))?/i);
  if (!match) return null;
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : null;
  return { type: match[1], number: String(Number(match[2])), year };
}

async function signedStorageUrl(client: any, bucket: string, path: string | null | undefined) {
  if (!path) return null;
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24);
  return !error && data?.signedUrl ? String(data.signedUrl) : null;
}

export async function recoverOfficialGazetteEvidence(params: {
  client: any; organizationId: string; question: string;
}): Promise<GovernanceRecoveryEvidence[]> {
  const reference = structuredActReference(params.question);
  let query = params.client
    .from("governance_official_gazette_acts")
    .select("id,document_id,chunk_id,act_type,act_number,act_year,edition_number,publication_date,page_number,title,content,normalized_content")
    .eq("organization_id", params.organizationId)
    .eq("status", "active");

  if (reference) {
    query = query.eq("act_type", reference.type).eq("act_number", reference.number);
    if (reference.year) query = query.eq("act_year", reference.year);
  }

  const { data, error } = await query.limit(reference ? 5 : 250);
  if (error) throw new Error(`Falha na recuperação do Diário Oficial: ${error.message}`);

  const rows = data ?? [];
  const documentIds = Array.from(new Set(rows.map((row: any) => row.document_id).filter(Boolean)));
  const documentUrls = new Map<string, string | null>();

  if (documentIds.length) {
    const { data: documents } = await params.client
      .from("governance_official_gazette_documents")
      .select("id,storage_path,pdf_url")
      .in("id", documentIds);
    for (const document of documents ?? []) {
      const signed = await signedStorageUrl(
        params.client,
        "governance-documents",
        document.storage_path,
      );
      documentUrls.set(String(document.id), signed || String(document.pdf_url ?? "").trim() || null);
    }
  }

  return rows.map((row: any) => {
    const lexical = scoreLexicalEvidence(params.question, row.title, row.normalized_content || row.content);
    const structuredBonus = reference ? 100 : 0;
    const score = lexical + structuredBonus;
    return {
      id: String(row.id),
      provider: "official_gazette" as const,
      title: String(row.title ?? "Ato do Diário Oficial"),
      content: String(row.content ?? ""),
      normalizedContent: String(row.normalized_content ?? ""),
      score,
      confidence: confidence(score),
      sourceUrl: documentUrls.get(String(row.document_id)) ?? null,
      documentId: row.document_id ?? null,
      chunkId: row.chunk_id ?? null,
      metadata: {
        act_type: row.act_type, act_number: row.act_number, act_year: row.act_year,
        edition_number: row.edition_number, publication_date: row.publication_date,
        page_number: row.page_number, exact_reference: Boolean(reference),
      },
    };
  }).filter((item: GovernanceRecoveryEvidence) => item.score > 0);
}

export async function recoverInstitutionalEvidence(params: {
  client: any; organizationId: string; question: string;
}): Promise<GovernanceRecoveryEvidence[]> {
  const { data: documents, error: documentsError } = await params.client
    .from("institutional_documents")
    .select("id,title,source_url,storage_bucket,storage_path")
    .eq("organization_id", params.organizationId);

  if (documentsError) throw new Error(`Falha ao carregar documentos institucionais: ${documentsError.message}`);

  const normalizedQuestion = normalizeRecoveryText(params.question);
  const exactDocumentIds = new Set(
    (documents ?? [])
      .filter((doc: any) => {
        const title = normalizeRecoveryText(doc.title);
        return title.length >= 8 && normalizedQuestion.includes(title);
      })
      .map((doc: any) => String(doc.id)),
  );

  let chunksQuery = params.client
    .from("institutional_document_chunks")
    .select("id,document_id,chunk_index,page,content,normalized_content,keywords,status")
    .eq("organization_id", params.organizationId)
    .eq("status", "active");

  if (exactDocumentIds.size > 0) {
    chunksQuery = chunksQuery.in("document_id", Array.from(exactDocumentIds));
  }

  const { data: chunks, error } = await chunksQuery.limit(1000);
  if (error) throw new Error(`Falha na recuperação institucional: ${error.message}`);

  const docMap = new Map<string, any>();
  for (const doc of documents ?? []) docMap.set(String(doc.id), doc);

  const urlMap = new Map<string, string | null>();
  const documentIds = Array.from(
    new Set<string>((chunks ?? []).map((row: any) => String(row.document_id))),
  );

  for (const docId of documentIds) {
    const doc = docMap.get(docId);
    if (!doc) continue;
    const signed = await signedStorageUrl(
      params.client,
      String(doc.storage_bucket ?? "governance-documents"),
      doc.storage_path,
    );
    urlMap.set(docId, String(doc.source_url ?? "").trim() || signed || null);
  }

  return (chunks ?? []).map((row: any) => {
    const doc = docMap.get(String(row.document_id));
    const title = String(doc?.title ?? "Documento institucional");
    const exactBonus = exactDocumentIds.has(String(row.document_id)) ? 60 : 0;
    const score = scoreLexicalEvidence(params.question, title, row.normalized_content || row.content) + exactBonus;
    return {
      id: String(row.id),
      provider: "institutional" as const,
      title,
      content: String(row.content ?? ""),
      normalizedContent: String(row.normalized_content ?? ""),
      score,
      confidence: confidence(score),
      sourceUrl: urlMap.get(String(row.document_id)) ?? null,
      documentId: row.document_id ?? null,
      chunkId: String(row.id),
      metadata: {
        chunk_index: row.chunk_index, page: row.page, keywords: row.keywords ?? [],
        exact_document: exactDocumentIds.has(String(row.document_id)),
      },
    };
  }).filter((item: GovernanceRecoveryEvidence) => item.score > 0);
}

export async function recoverLegalEvidence(question: string): Promise<GovernanceRecoveryEvidence[]> {
  const analysis = analyzeGovernanceQuery(question);
  return getGovernanceLegalCatalogForQuery(analysis).map((item) => ({
    id: item.id,
    provider: "legal" as const,
    title: item.title,
    content: item.notes ?? item.title,
    normalizedContent: normalizeRecoveryText(`${item.title} ${item.notes ?? ""}`),
    score: 25,
    confidence: 0.6,
    sourceUrl: item.url ?? null,
    documentId: null,
    chunkId: null,
    metadata: { type: item.type },
  }));
}
