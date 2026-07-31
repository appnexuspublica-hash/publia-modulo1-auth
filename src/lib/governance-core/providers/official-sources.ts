import { normalizeRecoveryText } from "@/lib/governance/recovery/normalize";
import type { GovernanceV2Evidence, GovernanceV2QueryPlan } from "../types";

function sourceRank(name: string, type: string, plan: GovernanceV2QueryPlan) {
  const value = normalizeRecoveryText(`${name} ${type}`);
  const financial = plan.intent === "financial_fact" || /despesa|pagamento|transparencia/.test(plan.normalizedQuestion);
  const contest = /concurso|processo seletivo|edital|cargo|vaga/.test(plan.normalizedQuestion);

  if (financial) {
    if (/betha/.test(value) && /transparencia/.test(value)) return 100;
    if (/portal.*transparencia|transparencia/.test(value) && !/emenda pix/.test(value)) return 95;
    if (/diario oficial/.test(value)) return 85;
    if (/site oficial|site municipal|prefeitura/.test(value)) return 80;
    return 0;
  }

  if (contest) {
    if (/diario oficial/.test(value)) return 100;
    if (/site oficial|site municipal|prefeitura/.test(value)) return 90;
    return 0;
  }

  if (/portal.*transparencia|betha.*transparencia/.test(value)) return 100;
  if (/diario oficial/.test(value)) return 90;
  if (/site oficial|site municipal|prefeitura/.test(value)) return 80;
  return 0;
}

function canonicalKey(title: string, url: string) {
  const normalizedTitle = normalizeRecoveryText(title)
    .replace(/portal da transparencia|portal transparencia/g, "portal transparencia")
    .replace(/site oficial do municipio|site oficial|site municipal/g, "site oficial municipio")
    .replace(/diario oficial do municipio|diario oficial/g, "diario oficial municipio");
  try {
    const parsed = new URL(url);
    return `${normalizedTitle}::${parsed.hostname.toLowerCase()}::${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return `${normalizedTitle}::${url}`;
  }
}

export async function recoverOfficialSourcesV2(params: {
  client: any;
  organizationId: string;
  plan: GovernanceV2QueryPlan;
}): Promise<GovernanceV2Evidence[]> {
  const { data, error } = await params.client
    .from("official_sources")
    .select("id,name,source_type,url,notes,status,priority,reviewed_at")
    .eq("organization_id", params.organizationId)
    .eq("status", "active")
    .order("priority", { ascending: true })
    .limit(50);

  if (error) throw new Error(`Falha ao carregar Fontes Oficiais: ${error.message}`);

  const unique = new Map<string, GovernanceV2Evidence>();
  for (const row of data ?? []) {
    const title = String(row.name ?? "").trim();
    const url = String(row.url ?? "").trim();
    if (!title || !url) continue;

    const score = sourceRank(title, String(row.source_type ?? ""), params.plan);
    if (score <= 0) continue;

    const evidence: GovernanceV2Evidence = {
      evidenceId: `official_sources:${row.id}`,
      provider: "official_sources",
      title,
      excerpt: String(
        row.notes || "Local oficial de consulta. Nenhum dado factual específico foi recuperado deste portal.",
      ),
      url,
      documentId: null,
      chunkId: null,
      score,
      exact: false,
      factual: false,
      metadata: {
        source_type: row.source_type,
        priority: row.priority,
        evidence_role: "directory_reference",
      },
    };

    const key = canonicalKey(title, url);
    const existing = unique.get(key);
    if (!existing || evidence.score > existing.score) unique.set(key, evidence);
  }

  const contest = /concurso|processo seletivo|edital|cargo|vaga/.test(params.plan.normalizedQuestion);
  const max = params.plan.intent === "financial_fact" ? 2 : contest ? 2 : 4;
  return Array.from(unique.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}
