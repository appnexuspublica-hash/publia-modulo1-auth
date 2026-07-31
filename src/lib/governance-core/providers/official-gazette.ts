import { normalizeRecoveryText } from "@/lib/governance/recovery/normalize";
import type { GovernanceV2Evidence, GovernanceV2QueryPlan } from "../types";
import { containsAll, createStableSourceUrl, lexicalScore } from "./common";

function sameAct(row: any, plan: GovernanceV2QueryPlan) {
  if (!plan.entities.actType || !plan.entities.actNumber) return true;
  const rowType = normalizeRecoveryText(String(row.act_type ?? row.title ?? ""));
  const rowNumber = String(Number(String(row.act_number ?? "").replace(/\D/g, "")));
  const rowYear = Number(row.act_year ?? 0);
  return rowType.includes(plan.entities.actType)
    && rowNumber === plan.entities.actNumber
    && (!plan.entities.actYear || rowYear === plan.entities.actYear);
}

function actIdentity(row: any) {
  return [
    normalizeRecoveryText(String(row.act_type ?? "ato")),
    String(Number(String(row.act_number ?? "").replace(/\D/g, ""))),
    String(row.act_year ?? ""),
  ].join(":");
}

export async function recoverOfficialGazetteV2(params: {
  client: any;
  organizationId: string;
  question: string;
  plan: GovernanceV2QueryPlan;
}): Promise<GovernanceV2Evidence[]> {
  let query = params.client
    .from("governance_official_gazette_acts")
    .select("id,document_id,chunk_id,act_type,act_number,act_year,edition_number,publication_date,page_number,title,content,normalized_content,status")
    .eq("organization_id", params.organizationId)
    .eq("status", "active");

  const exact = Boolean(params.plan.entities.actType && params.plan.entities.actNumber);
  if (params.plan.entities.actYear) query = query.eq("act_year", params.plan.entities.actYear);
  if (!exact && params.plan.entities.year) {
    query = query
      .gte("publication_date", `${params.plan.entities.year}-01-01`)
      .lte("publication_date", `${params.plan.entities.year}-12-31`);
  }

  const { data, error } = await query.order("publication_date", { ascending: false }).limit(exact ? 100 : 500);
  if (error) throw new Error(`Falha na recuperação do Diário Oficial: ${error.message}`);

  const rows = (data ?? []).filter((row: any) => sameAct(row, params.plan));
  const documentIds = Array.from(new Set(rows.map((row: any) => String(row.document_id)).filter(Boolean)));
  const docMap = new Map<string, any>();

  if (documentIds.length) {
    const { data: docs, error: docsError } = await params.client
      .from("governance_official_gazette_documents")
      .select("id,edition_number,publication_date,storage_path,pdf_url")
      .in("id", documentIds);
    if (docsError) throw new Error(`Falha ao carregar documentos do Diário Oficial: ${docsError.message}`);
    for (const doc of docs ?? []) docMap.set(String(doc.id), doc);
  }

  const bestByAct = new Map<string, GovernanceV2Evidence>();
  for (const row of rows) {
    const text = `${row.title}\n${row.normalized_content || row.content}`;
    const normalized = normalizeRecoveryText(text);

    if (params.plan.entities.companyTerms.length) {
      if (!containsAll(text, params.plan.entities.companyTerms)) continue;
      if (!/\b(pagamento|pagamentos|pago|pagos|empenho|empenhos|liquidacao|credor|favorecido|despesa)\b/.test(normalized)) continue;
    }

    if (params.plan.entities.roleTerms.length) {
      if (!containsAll(text, params.plan.entities.roleTerms)) continue;
      if (!/\b(concurso|processo seletivo|edital)\b/.test(normalized)) continue;
    }

    const score = lexicalScore(params.question, String(row.title || ""), String(row.normalized_content || row.content)) + (exact ? 200 : 0);
    if (!exact && score < 14) continue;

    const doc = docMap.get(String(row.document_id));
    const url = await createStableSourceUrl(params.client, "governance-documents", doc?.storage_path, doc?.pdf_url);
    const title = String(row.title || `${row.act_type || "Ato"} nº ${row.act_number || ""}/${row.act_year || ""}`).trim();
    const evidence: GovernanceV2Evidence = {
      evidenceId: `official_gazette:${row.id}`,
      provider: "official_gazette",
      title,
      excerpt: String(row.content || "").trim(),
      url,
      documentId: row.document_id ? String(row.document_id) : null,
      chunkId: row.chunk_id ? String(row.chunk_id) : null,
      score,
      exact,
      factual: true,
      metadata: {
        act_type: row.act_type,
        act_number: row.act_number,
        act_year: row.act_year,
        edition_number: row.edition_number ?? doc?.edition_number ?? null,
        publication_date: row.publication_date ?? doc?.publication_date ?? null,
        page_number: row.page_number,
        document_title: row.edition_number || doc?.edition_number
          ? `Diário Oficial do Município — Edição nº ${row.edition_number ?? doc?.edition_number}`
          : "Diário Oficial do Município",
        document_url: url,
      },
    };

    const key = actIdentity(row);
    const existing = bestByAct.get(key);
    if (!existing || evidence.score > existing.score) bestByAct.set(key, evidence);
  }

  return Array.from(bestByAct.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, exact ? 1 : 8);
}
