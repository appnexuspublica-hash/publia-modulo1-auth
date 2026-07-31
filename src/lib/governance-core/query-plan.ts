import { normalizeRecoveryText } from "@/lib/governance/recovery/normalize";
import type { GovernanceV2QueryPlan } from "./types";
import { resolveGovernanceLegalTopic } from "./legal-topics";

const STOP = new Set([
  "para","pelo","pela","municipio","municipal","publico","publicos","foram",
  "empresa","cargo","vaga","de","da","do","em","no","na","nos","nas",
]);

function terms(value: string) {
  return normalizeRecoveryText(value)
    .split(/\s+/)
    .filter((term) => term.length >= 3 && !STOP.has(term));
}

function normalizeActType(value: string | undefined) {
  return normalizeRecoveryText(value ?? "") || null;
}

function hasInstitutionalObject(q: string) {
  return /\b(plano de cargos|plano de carreira|lei organica|codigo tributario|plano diretor|estatuto|regulamento|manual|organograma|documento institucional|magisterio)\b/.test(q);
}

function isDirectInstitutionalQuestion(q: string) {
  const hasInstitutionalDocument = hasInstitutionalObject(q);
  if (!hasInstitutionalDocument) return false;

  const asksDocumentContent =
    /\b(segundo|conforme|apresente|resuma|resumo|conteudo|texto|artigo|capitulo|transcreva)\b/.test(q) ||
    /\bo que\b.{0,120}\b(diz|estabelece|preve|determina|disciplina|regulamenta|trata)\b/.test(q) ||
    /\b(diz|estabelece|preve|determina|disciplina|regulamenta|trata)\b.{0,120}\b(plano de cargos|plano de carreira|lei organica|codigo tributario|plano diretor|estatuto|regulamento|manual|organograma|magisterio)\b/.test(q);

  return asksDocumentContent;
}

function isDirectGazetteQuestion(q: string, hasAct: boolean) {
  return hasAct ||
    /\b(diario oficial|publicad[oa]s?|edicao|edicoes|ato|atos|nomeacao|exoneracao|concurso aberto|concurso publico|processo seletivo)\b/.test(q);
}

function isFinancialFactQuestion(q: string) {
  return /\b(valor|valores|pagamento|pagamentos|pago|pagos|empenho|empenhos|liquidacao|credor|favorecido|despesa|despesas)\b/.test(q) &&
    /\b(empresa|fornecedor|credor|favorecido)\b/.test(q);
}

function isGeneralLegalQuestion(q: string) {
  return /\b(constituicao|principios constitucionais|lei federal|artigo|legalidade|juridicidade|lrf|lai|lgpd|protecao de dados|dados pessoais|privacidade|lei 14\.?133|licitacoes e contratos|irrf|imposto de renda|retencao|tributacao|pode ficar com|pode contratar|pode comprar|sem licitar|sem licitacao|dispensas?|dispensa de licitacao|inexigibilidade|fracionamento|dividir (?:uma )?compra|limite de dispensa|limite de contratacao|quanto pode ser contratado|quanto a prefeitura pode comprar)\b/.test(q);
}

export function isGovernanceV2KnowledgePrimaryQuestion(question: string) {
  const q = normalizeRecoveryText(question);
  const hasDirectLocalDocument = isDirectInstitutionalQuestion(q);
  const hasDirectGazette = isDirectGazetteQuestion(q, false);
  const hasFinancialFact = isFinancialFactQuestion(q);
  const directory = /\b(onde consultar|onde posso consultar|qual portal|site oficial|fonte oficial|fontes oficiais|portal da transparencia|link oficial)\b/.test(q);

  return (isGeneralLegalQuestion(q) || !hasDirectLocalDocument && !hasDirectGazette && !hasFinancialFact && !directory) &&
    !hasDirectLocalDocument &&
    !hasDirectGazette &&
    !hasFinancialFact &&
    !directory;
}

function resolveAnswerShape(q: string, intent: GovernanceV2QueryPlan["intent"]): GovernanceV2QueryPlan["answerShape"] {
  if (intent === "official_directory") return "directory";
  if (intent === "comparison") return "comparison";
  if (intent === "institutional_document" || intent === "official_gazette") return "document_summary";
  if (/^(pode|e permitido|é permitido|sim ou nao|o municipio pode|a prefeitura pode)\b/.test(q)) return "yes_no";
  if (/\b(quanto|qual valor|quais valores|limite|percentual|prazo|quantos|quantas)\b/.test(q)) return "direct_numeric";
  return "direct";
}

export function buildGovernanceV2QueryPlan(question: string): GovernanceV2QueryPlan {
  const q = normalizeRecoveryText(question);
  const act = q.match(
    /\b(decreto|portaria|resolucao|lei complementar|lei|edital|contrato|instrucao normativa)\s+(?:(?:n|no|numero)\s*)?0*(\d{1,8})(?:[./\s-]+(\d{2,4}))?/,
  );
  const yearMatch = q.match(/\b(20\d{2}|19\d{2})\b/);
  const company = q.match(/\bempresa\s+(.+?)(?:\s+em\s+\d{4}\b|$)/);
  const role = q.match(
    /\b(?:cargo|vaga|concurso(?:s)?(?:\s+publico(?:s)?)?(?:\s+aberto(?:s)?)?)\s+(?:de|para)?\s*(.+?)(?:\s+em\s+\d{4}\b|$)/,
  );

  const directory = /\b(onde consultar|onde posso consultar|qual portal|site oficial|fonte oficial|fontes oficiais|portal da transparencia|link oficial)\b/.test(q);
  const financial = isFinancialFactQuestion(q);
  const comparison = /\b(compare|comparar|comparacao|confronte)\b/.test(q);
  const institutional = isDirectInstitutionalQuestion(q);
  const institutionalObject = hasInstitutionalObject(q);
  const gazette = isDirectGazetteQuestion(q, Boolean(act));
  const legal = isGeneralLegalQuestion(q);
  const legalTopic = resolveGovernanceLegalTopic(question);

  let intent: GovernanceV2QueryPlan["intent"] = "mixed";
  let requiredProviders: GovernanceV2QueryPlan["requiredProviders"] = [];
  let optionalProviders: GovernanceV2QueryPlan["optionalProviders"] = [];

  if (directory) {
    intent = "official_directory";
    requiredProviders = ["official_sources"];
  } else if (financial) {
    intent = "financial_fact";
    requiredProviders = ["official_gazette"];
    optionalProviders = ["official_sources"];
  } else if (comparison) {
    intent = "comparison";
    requiredProviders = institutionalObject && gazette
      ? ["institutional", "official_gazette"]
      : institutionalObject
        ? ["institutional"]
        : gazette
          ? ["official_gazette"]
          : ["institutional"];
    optionalProviders = ["legal", "official_sources"];
  } else if (institutional) {
    intent = "institutional_document";
    requiredProviders = ["institutional"];
    optionalProviders = ["legal"];
  } else if (gazette) {
    intent = "official_gazette";
    requiredProviders = ["official_gazette"];
    optionalProviders = ["official_sources", "legal"];
  } else if (legal) {
    intent = "general_legal";
    requiredProviders = ["legal"];
  } else {
    intent = "general_administrative";
    optionalProviders = ["legal"];
  }

  const answerShape = resolveAnswerShape(q, intent);

  return {
    version: "v2",
    legalTopic,
    intent,
    answerShape,
    normalizedQuestion: q,
    requiredProviders,
    optionalProviders,
    entities: {
      actType: normalizeActType(act?.[1]),
      actNumber: act?.[2] ? String(Number(act[2])) : null,
      actYear: act?.[3] ? Number(act[3].length === 2 ? `20${act[3]}` : act[3]) : null,
      year: yearMatch ? Number(yearMatch[1]) : null,
      companyTerms: company?.[1] ? terms(company[1]) : [],
      roleTerms: role?.[1] ? terms(role[1]) : [],
      topics: terms(question).slice(0, 16),
    },
  };
}
