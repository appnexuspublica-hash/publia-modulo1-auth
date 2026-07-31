import type { GovernanceMessage } from "@/types/governance";

export const MAX_GOVERNANCE_HISTORY_MESSAGES = 6;

export type ConversationRelation =
  | "INICIAL"
  | "CONTINUA"
  | "CONTINUA_COMPLEMENTAR"
  | "RELACIONA"
  | "ROMPE";

type GovernanceHistoryParams = {
  supabase: any;
  organizationId: string;
  conversationId: string;
  currentUserMessageId: string;
  currentUserQuestion: string;
  limit?: number;
};

export type GovernanceHistoryResult =
  | {
      ok: true;
      history: GovernanceMessage[];
      previousUserQuestion: string;
      relation: ConversationRelation;
    }
  | {
      ok: false;
      error: unknown;
    };

const GOVERNANCE_CONTEXT_DOMAINS: Record<string, RegExp> = {
  fiscal_arrecadacao:
    /\b(arrecadacao|arrecadação|receita|tributo|tributario|tributária|imposto|iptu|iss|itbi|taxa|taxas|divida ativa|dívida ativa|contribuinte|cadastro imobiliario|cadastro imobiliário|cadastro mobiliario|cadastro mobiliário|cobranca|cobrança|inadimplencia|inadimplência|refis|pgv|planta generica|planta genérica|inteligencia de dados|inteligência de dados|dados fiscais|gestao fiscal|gestão fiscal)\b/,
  transparencia:
    /\b(transparencia|transparência|portal da transparencia|portal da transparência|lai|lei de acesso|acesso a informacao|acesso à informação|contas publicas|contas públicas|sic|e-sic|controle social|audiencia publica|audiência pública|dados abertos)\b/,
  contratacoes:
    /\b(licitacao|licitação|licitacoes|licitações|contratacao|contratação|contratacoes|contratações|contrato|contratos|pca|plano de contratacoes|plano de contratações|etp|estudo tecnico preliminar|estudo técnico preliminar|termo de referencia|termo de referência|tr|matriz de riscos|dispensa|inexigibilidade|pregao|pregão|ata de registro|carona|reajuste|repactuacao|repactuação)\b/,
  pessoal_rh:
    /\b(servidor|servidores|ferias|férias|decimo terceiro|décimo terceiro|13o|13º|folha|remuneracao|remuneração|vencimento|cargo|concurso|admissao|admissão|contratacao temporaria|contratação temporária|estatutario|estatutário|rh|recursos humanos)\b/,
  lrf_pessoal:
    /\b(lrf|lei de responsabilidade fiscal|limite prudencial|limite maximo|limite máximo|despesa com pessoal|rcl|receita corrente liquida|receita corrente líquida|gasto com pessoal)\b/,
  contabilidade:
    /\b(contabilidade|contabil|contábil|orcamento|orçamento|orcamentaria|orçamentária|empenho|liquidacao|liquidação|pagamento|dotacao|dotação|gnd|elemento de despesa|restos a pagar|balanco|balanço)\b/,
  controle_interno:
    /\b(controle interno|auditoria|conformidade|governanca|governança|risco|riscos|responsabilizacao|responsabilização|tce|tribunal de contas|ministerio publico|ministério público)\b/,
  urbanismo:
    /\b(plano diretor|zoneamento|uso do solo|parcelamento do solo|mobilidade urbana|cidade|urbanismo|habite-se|alvara de construcao|alvará de construção|obra particular)\b/,
  lgpd:
    /\b(lgpd|dados pessoais|proteção de dados|protecao de dados|encarregado de dados|dpo|privacidade)\b/,
};

const RELATED_CONTEXT_DOMAIN_PAIRS = new Set([
  "fiscal_arrecadacao::transparencia",
  "transparencia::fiscal_arrecadacao",
  "fiscal_arrecadacao::contabilidade",
  "contabilidade::fiscal_arrecadacao",
  "fiscal_arrecadacao::controle_interno",
  "controle_interno::fiscal_arrecadacao",
  "transparencia::controle_interno",
  "controle_interno::transparencia",
  "transparencia::contratacoes",
  "contratacoes::transparencia",
  "contratacoes::controle_interno",
  "controle_interno::contratacoes",
  "contratacoes::contabilidade",
  "contabilidade::contratacoes",
  "pessoal_rh::lrf_pessoal",
  "lrf_pessoal::pessoal_rh",
  "lrf_pessoal::contabilidade",
  "contabilidade::lrf_pessoal",
]);

function normalizeAdministrativeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectGovernanceContextDomains(text: string) {
  const normalized = normalizeAdministrativeText(text);
  const domains: string[] = [];

  for (const [domain, pattern] of Object.entries(GOVERNANCE_CONTEXT_DOMAINS)) {
    if (pattern.test(normalized)) {
      domains.push(domain);
    }
  }

  return domains;
}

function hasExplicitContinuationCue(userText: string) {
  const q = normalizeAdministrativeText(userText);

  return /\b(para isso|sobre isso|nesse caso|neste caso|nesse contexto|neste contexto|com base nisso|diante disso|a partir disso|essas medidas|essas acoes|essas ações|isso|esse tema|essa situacao|essa situação|e como|e quais|e qual|qual a diferenca|qual a diferença|quais medidas|proximo passo|próximo passo|como mensurar|como acompanhar|como implementar)\b/.test(q);
}

function isComplementaryContinuationQuestion(userText: string) {
  const q = normalizeAdministrativeText(userText);

  if (!q.trim()) {
    return false;
  }

  const asksMeasurementOrFollowUp =
    /\b(como medir|como mensurar|como acompanhar|como monitorar|como avaliar|como verificar|como controlar|como saber se|como demonstrar|como comprovar|quais indicadores|quais metricas|quais métricas|quais kpis|indicadores|metricas|métricas|resultados|metas|painel|dashboard|relatorio|relatório)\b/.test(q);

  const refersToPreviousActions =
    /\b(essas medidas|essas acoes|essas ações|esses pontos|essas providencias|essas providências|isso|desse plano|deste plano|da estrategia|da estratégia|do que foi dito|do que foi discutido|na pratica|na prática)\b/.test(q);

  return asksMeasurementOrFollowUp || refersToPreviousActions;
}

export function classifyConversationRelation(params: {
  previousUserQuestion: string;
  currentUserQuestion: string;
}): ConversationRelation {
  const previous = params.previousUserQuestion.trim();
  const current = params.currentUserQuestion.trim();

  if (!previous) {
    return "INICIAL";
  }

  const isComplementary = isComplementaryContinuationQuestion(current);

  if (hasExplicitContinuationCue(current)) {
    return isComplementary ? "CONTINUA_COMPLEMENTAR" : "CONTINUA";
  }

  const previousDomains = detectGovernanceContextDomains(previous);
  const currentDomains = detectGovernanceContextDomains(current);

  if (previousDomains.length === 0 || currentDomains.length === 0) {
    return "ROMPE";
  }

  const previousDomainSet = new Set(previousDomains);

  if (currentDomains.some((domain) => previousDomainSet.has(domain))) {
    return isComplementary ? "CONTINUA_COMPLEMENTAR" : "CONTINUA";
  }

  const hasRelatedDomain = previousDomains.some((previousDomain) =>
    currentDomains.some((currentDomain) =>
      RELATED_CONTEXT_DOMAIN_PAIRS.has(`${previousDomain}::${currentDomain}`),
    ),
  );

  return hasRelatedDomain ? "RELACIONA" : "ROMPE";
}

export function getPreviousUserQuestion(
  history: GovernanceMessage[],
  currentUserMessageId: string,
) {
  return (
    [...history]
      .reverse()
      .find(
        (message) =>
          message.role === "user" &&
          message.id !== currentUserMessageId &&
          String(message.content ?? "").trim().length > 0,
      )?.content ?? ""
  );
}

export async function loadGovernanceConversationHistory(
  params: GovernanceHistoryParams,
): Promise<GovernanceHistoryResult> {
  const { data, error } = await params.supabase
    .from("governance_messages")
    .select(
      `
        id,
        organization_id,
        conversation_id,
        user_id,
        role,
        content,
        metadata,
        created_at
      `,
    )
    .eq("organization_id", params.organizationId)
    .eq("conversation_id", params.conversationId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? MAX_GOVERNANCE_HISTORY_MESSAGES);

  if (error) {
    return {
      ok: false,
      error,
    };
  }

  const history = ((data ?? []) as GovernanceMessage[]).reverse();
  const previousUserQuestion = getPreviousUserQuestion(
    history,
    params.currentUserMessageId,
  );

  return {
    ok: true,
    history,
    previousUserQuestion,
    relation: classifyConversationRelation({
      previousUserQuestion,
      currentUserQuestion: params.currentUserQuestion,
    }),
  };
}
