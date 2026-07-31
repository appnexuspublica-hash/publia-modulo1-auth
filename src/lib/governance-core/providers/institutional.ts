import { normalizeRecoveryText } from "@/lib/governance/recovery/normalize";
import type { GovernanceV2Evidence, GovernanceV2QueryPlan } from "../types";
import { containsAll, lexicalScore } from "./common";

const DOCUMENT_SYNONYMS: Array<{ query: RegExp; title: RegExp; weight: number }> = [
  { query: /plano de cargos|plano de carreira|progressao funcional|progressao horizontal|progressao vertical/, title: /plano de cargos|carreiras e vencimentos|servidores municipais/, weight: 220 },
  { query: /magisterio|professor|professores|docente|educacao/, title: /magisterio|professor|docente|educacao/, weight: 260 },
  { query: /lei organica/, title: /lei organica/, weight: 240 },
  { query: /codigo tributario|tributacao municipal/, title: /codigo tributario/, weight: 240 },
  { query: /plano diretor|zoneamento|uso do solo/, title: /plano diretor/, weight: 240 },
  { query: /estatuto dos servidores|regime juridico/, title: /estatuto.*servidores|servidores municipais/, weight: 220 },
];

function expandedQuestion(plan: GovernanceV2QueryPlan, question: string) {
  const additions: string[] = [];
  const q = plan.normalizedQuestion;

  if (/progressao|plano de cargos|plano de carreira/.test(q)) {
    additions.push(
      "progressao funcional horizontal vertical desempenho merecimento intersticio referencia nivel titulacao qualificacao aperfeicoamento capacitacao",
    );
  }
  if (/magisterio|professor|docente/.test(q)) {
    additions.push(
      "magisterio professor docente carreira remuneracao progressao promocao titulacao classe nivel referencia",
    );
  }

  return [question, ...additions].join(" ");
}

function documentAffinity(doc: any, plan: GovernanceV2QueryPlan, question: string) {
  const q = plan.normalizedQuestion;
  const title = normalizeRecoveryText(String(doc.title ?? ""));
  const category = normalizeRecoveryText(String(doc.category ?? ""));
  const type = normalizeRecoveryText(String(doc.document_type ?? ""));
  const extracted = normalizeRecoveryText(String(doc.extracted_text ?? "")).slice(0, 24000);
  const query = expandedQuestion(plan, question);
  let score = lexicalScore(query, `${title} ${category} ${type}`, extracted);

  for (const synonym of DOCUMENT_SYNONYMS) {
    if (synonym.query.test(q) && synonym.title.test(`${title} ${category} ${type}`)) score += synonym.weight;
  }

  const teacherQuestion = /\b(magisterio|professor|professores|docente|educacao)\b/.test(q);
  const careerQuestion = /\b(plano de cargos|plano de carreira|progressao funcional|progressao)\b/.test(q);
  if (teacherQuestion && !/magisterio|professor|docente|educacao/.test(`${title} ${category}`)) score -= 180;
  if (!teacherQuestion && careerQuestion && /magisterio|professor|docente/.test(`${title} ${category}`)) score -= 260;

  if (q.includes(title) && title.length >= 8) score += 220;
  if (doc.review_status === "approved") score += 30;
  if (doc.indexing_status === "indexed") score += 15;
  if (String(doc.extracted_text ?? "").trim().length >= 500) score += 15;
  return score;
}

function splitExtractedText(value: string) {
  const text = String(value ?? "").trim();
  if (!text) return [];
  const size = 2400;
  const overlap = 400;
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += size - overlap) {
    chunks.push(text.slice(start, start + size));
    if (start + size >= text.length) break;
  }
  return chunks;
}

function institutionalOpenUrl(documentId: string) {
  return `/api/governance/institutional-documents?action=open&documentId=${encodeURIComponent(documentId)}`;
}

function candidateKey(content: string) {
  return normalizeRecoveryText(content).slice(0, 220);
}

export async function recoverInstitutionalV2(params: {
  client: any;
  organizationId: string;
  question: string;
  plan: GovernanceV2QueryPlan;
}): Promise<GovernanceV2Evidence[]> {
  const { data: documents, error: documentsError } = await params.client
    .from("institutional_documents")
    .select("id,title,document_type,category,source_url,storage_bucket,storage_path,extracted_text,review_status,indexing_status,valid_from,valid_until")
    .eq("organization_id", params.organizationId)
    .eq("review_status", "approved");

  if (documentsError) throw new Error(`Falha ao carregar documentos institucionais: ${documentsError.message}`);

  const rankedDocuments = (documents ?? [])
    .map((doc: any) => ({ doc, affinity: documentAffinity(doc, params.plan, params.question) }))
    .filter((item: any) => item.affinity >= 25)
    .sort((a: any, b: any) => b.affinity - a.affinity);

  const documentLimit = params.plan.intent === "comparison" ? 2 : 1;
  const selectedDocuments = rankedDocuments.slice(0, documentLimit);
  if (selectedDocuments.length === 0) return [];

  const docMap = new Map(selectedDocuments.map((item: any) => [String(item.doc.id), item]));
  const { data: chunks, error } = await params.client
    .from("institutional_document_chunks")
    .select("id,document_id,chunk_index,page,content,normalized_content,keywords,status")
    .eq("organization_id", params.organizationId)
    .in("status", ["active", "pending_review"])
    .in("document_id", Array.from(docMap.keys()))
    .order("chunk_index", { ascending: true })
    .limit(1500);

  if (error) throw new Error(`Falha na recuperação institucional: ${error.message}`);

  const rowsByDocument = new Map<string, any[]>();
  for (const row of chunks ?? []) {
    const key = String(row.document_id);
    const list = rowsByDocument.get(key) ?? [];
    list.push(row);
    rowsByDocument.set(key, list);
  }

  const output: GovernanceV2Evidence[] = [];
  const expanded = expandedQuestion(params.plan, params.question);

  for (const ranked of selectedDocuments) {
    const doc = ranked.doc;
    const documentId = String(doc.id);
    const storedRows = rowsByDocument.get(documentId) ?? [];
    const extractedRows = splitExtractedText(String(doc.extracted_text ?? "")).map((content, index) => ({
      id: `extracted-${documentId}-${index}`,
      document_id: documentId,
      chunk_index: index,
      page: null,
      content,
      normalized_content: normalizeRecoveryText(content),
      keywords: [],
      fallback: true,
    }));

    const combinedRows = [...storedRows, ...extractedRows];
    const dedup = new Map<string, any>();
    for (const row of combinedRows) {
      const key = candidateKey(String(row.content ?? row.normalized_content ?? ""));
      if (!key) continue;
      const existing = dedup.get(key);
      if (!existing || (existing.fallback && !row.fallback)) dedup.set(key, row);
    }

    const candidates: GovernanceV2Evidence[] = [];
    for (const row of dedup.values()) {
      const text = `${doc.title}\n${row.normalized_content || row.content}`;
      if (params.plan.entities.companyTerms.length && !containsAll(text, params.plan.entities.companyTerms)) continue;
      if (params.plan.entities.roleTerms.length && !containsAll(text, params.plan.entities.roleTerms)) continue;

      const normalizedTitle = normalizeRecoveryText(String(doc.title ?? ""));
      const exact = params.plan.normalizedQuestion.includes(normalizedTitle) && normalizedTitle.length >= 8;
      const contentScore = lexicalScore(expanded, String(doc.title), String(row.normalized_content || row.content));
      const score = ranked.affinity + contentScore + (exact ? 80 : 0) + (row.fallback ? 0 : 8);

      candidates.push({
        evidenceId: `institutional:${row.id}`,
        provider: "institutional",
        title: String(doc.title || "Documento institucional"),
        excerpt: String(row.content || "").trim(),
        url: institutionalOpenUrl(documentId),
        documentId,
        chunkId: row.fallback ? null : String(row.id),
        score,
        exact,
        factual: true,
        metadata: {
          page: row.page ?? null,
          chunk_index: row.chunk_index ?? null,
          keywords: row.keywords ?? [],
          document_affinity: ranked.affinity,
          content_score: contentScore,
          source_kind: row.fallback ? "extracted_text" : "stored_chunk",
          indexing_status: doc.indexing_status,
        },
      });
    }

    const best = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (best.length > 0) {
      output.push(...best);
      continue;
    }

    const fullText = String(doc.extracted_text ?? "").trim();
    if (fullText) {
      output.push({
        evidenceId: `institutional:document:${documentId}`,
        provider: "institutional",
        title: String(doc.title || "Documento institucional"),
        excerpt: fullText.slice(0, 6500),
        url: institutionalOpenUrl(documentId),
        documentId,
        chunkId: null,
        score: ranked.affinity,
        exact: true,
        factual: true,
        metadata: {
          document_affinity: ranked.affinity,
          source_kind: "document_text_fallback",
          indexing_status: doc.indexing_status,
        },
      });
    }
  }

  return output.sort((a, b) => b.score - a.score);
}
