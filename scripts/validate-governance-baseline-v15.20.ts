import fs from "node:fs";
import path from "node:path";

import { buildGovernanceV2QueryPlan } from "../src/lib/governance-core/query-plan";
import {
  GOVERNANCE_CORE_VERSION,
  GOVERNANCE_PIPELINE_VERSION,
  GOVERNANCE_RESULT_SNAPSHOT_VERSION,
} from "../src/lib/governance-core/version";
import { canonicalizeGovernanceV2References } from "../src/lib/governance-core/reference-canonicalizer";
import {
  buildGovernanceResultSnapshot,
  flattenGovernanceResultReferences,
  parseGovernanceResultSnapshot,
} from "../src/lib/governance/chat/governance-result";
import { resolveGovernanceIdempotencyLeaseSeconds } from "../src/lib/governance/chat/idempotency";
import type {
  GovernanceChatReference,
  GovernanceChatSource,
} from "../src/lib/governance/chat/references";

type PlanExpectation = {
  question: string;
  intent: ReturnType<typeof buildGovernanceV2QueryPlan>["intent"];
  answerShape?: ReturnType<typeof buildGovernanceV2QueryPlan>["answerShape"];
  legalTopic?: ReturnType<typeof buildGovernanceV2QueryPlan>["legalTopic"];
  requiredProviders?: string[];
  optionalProviders?: string[];
};

let failures = 0;
let checks = 0;

function check(condition: unknown, message: string) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`ERRO: ${message}`);
    return;
  }
  console.log(`OK: ${message}`);
}

function sameItems(actual: string[], expected: string[]) {
  return [...actual].sort().join("|") === [...expected].sort().join("|");
}

const planCases: PlanExpectation[] = [
  {
    question: "Explique os princípios constitucionais da administração pública.",
    intent: "general_legal",
    legalTopic: "constitutional_principles",
    answerShape: "direct",
    requiredProviders: ["legal"],
  },
  {
    question: "O Município pode ficar com o IRRF retido dos pagamentos realizados?",
    intent: "general_legal",
    legalTopic: "municipal_irrf",
    answerShape: "yes_no",
    requiredProviders: ["legal"],
  },
  {
    question: "Quanto pode ser contratado sem licitação?",
    intent: "general_legal",
    legalTopic: "procurement_direct_award",
    answerShape: "direct_numeric",
    requiredProviders: ["legal"],
  },
  {
    question: "Pode dividir uma compra para ficar abaixo do limite de dispensa?",
    intent: "general_legal",
    legalTopic: "procurement_direct_award",
    answerShape: "yes_no",
    requiredProviders: ["legal"],
  },
  {
    question: "A Prefeitura pode realizar várias dispensas pequenas do mesmo objeto durante o ano?",
    intent: "general_legal",
    legalTopic: "procurement_direct_award",
    answerShape: "yes_no",
    requiredProviders: ["legal"],
  },
  {
    question: "O que o plano de cargos estabelece sobre progressão funcional?",
    intent: "institutional_document",
    answerShape: "document_summary",
    requiredProviders: ["institutional"],
    optionalProviders: ["legal"],
  },
  {
    question: "O que o plano de carreira do Magistério estabelece sobre progressão dos professores?",
    intent: "institutional_document",
    answerShape: "document_summary",
    requiredProviders: ["institutional"],
    optionalProviders: ["legal"],
  },
  {
    question: "O que a Lei Orgânica estabelece sobre as competências do Município?",
    intent: "institutional_document",
    answerShape: "document_summary",
    requiredProviders: ["institutional"],
  },
  {
    question: "O que o Código Tributário Municipal prevê sobre taxas?",
    intent: "institutional_document",
    answerShape: "document_summary",
    requiredProviders: ["institutional"],
  },
  {
    question: "Apresente o conteúdo do Decreto nº 046/2026 publicado no Diário Oficial.",
    intent: "official_gazette",
    answerShape: "document_summary",
    requiredProviders: ["official_gazette"],
  },
  {
    question: "Quais concursos para engenheiro ambiental foram publicados em 2026?",
    intent: "official_gazette",
    requiredProviders: ["official_gazette"],
  },
  {
    question: "Quais valores foram pagos à empresa Valter Patriarca em 2026?",
    intent: "financial_fact",
    answerShape: "direct_numeric",
    requiredProviders: ["official_gazette"],
    optionalProviders: ["official_sources"],
  },
  {
    question: "Onde consultar despesas e pagamentos do Município?",
    intent: "official_directory",
    answerShape: "directory",
    requiredProviders: ["official_sources"],
  },
  {
    question: "Como estruturar um programa municipal de integridade?",
    intent: "general_administrative",
    answerShape: "direct",
    optionalProviders: ["legal"],
  },
  {
    question: "Como elaborar uma política municipal de proteção de dados?",
    intent: "general_legal",
    answerShape: "direct",
    requiredProviders: ["legal"],
  },
  {
    question: "Compare o plano de cargos com as nomeações publicadas no Diário Oficial em 2026.",
    intent: "comparison",
    answerShape: "comparison",
    requiredProviders: ["institutional", "official_gazette"],
  },
];

for (const testCase of planCases) {
  const plan = buildGovernanceV2QueryPlan(testCase.question);
  const label = `plano: ${testCase.question}`;
  check(plan.intent === testCase.intent, `${label} → intenção ${testCase.intent}`);
  if (testCase.answerShape) {
    check(plan.answerShape === testCase.answerShape, `${label} → formato ${testCase.answerShape}`);
  }
  if (testCase.legalTopic !== undefined) {
    check(plan.legalTopic === testCase.legalTopic, `${label} → tópico jurídico ${String(testCase.legalTopic)}`);
  }
  if (testCase.requiredProviders) {
    check(
      sameItems(plan.requiredProviders, testCase.requiredProviders),
      `${label} → provedores obrigatórios ${testCase.requiredProviders.join(", ")}`,
    );
  }
  if (testCase.optionalProviders) {
    check(
      sameItems(plan.optionalProviders, testCase.optionalProviders),
      `${label} → provedores opcionais ${testCase.optionalProviders.join(", ")}`,
    );
  }
}

function source(
  id: string,
  title: string,
  url: string,
  supportText?: string,
): GovernanceChatSource {
  return { id, title, url, type: "official", supportText: supportText ?? null };
}

function reference(
  title: string,
  url: string | null,
  kind: GovernanceChatReference["kind"] = "legal",
): GovernanceChatReference {
  return { title, url, kind, origin: "web", supportText: null };
}

const procurementReferences = canonicalizeGovernanceV2References({
  question: "Pode dividir uma compra para ficar abaixo do limite de dispensa?",
  baseReferences: [
    reference("Lei 14.133/2021", "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm?utm_source=x"),
    reference("Lei nº 14.133/2021", "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm"),
  ],
  includeOfficialWebSources: true,
  officialWebSources: [
    source("1", "Lei 14.133/2021", "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm"),
    source("2", "Lei 14.133/2021", "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm?origin=consulta"),
    source("3", "pesquisa.apps.tcu.gov.br", "https://pesquisa.apps.tcu.gov.br/documento/acordao-completo/*"),
    source("4", "licitacoesecontratos.tcu.gov.br", "https://licitacoesecontratos.tcu.gov.br/5-10-2-dispensa-em-razao-do-valor/"),
    source("5", "portal.tcu.gov.br", "https://portal.tcu.gov.br/licitacoes-e-contratos"),
    source("6", "compras.gov.br", "https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos"),
  ],
});

const procurementLegal = procurementReferences.filter((item) => item.kind === "legal");
const procurementOfficial = procurementReferences.filter((item) => item.kind === "official");

check(
  procurementLegal.filter((item) => item.title.startsWith("Lei nº 14.133/2021")).length === 1,
  "canonicalização: Lei nº 14.133/2021 aparece uma única vez",
);
check(
  procurementLegal.some((item) => item.title.includes("Decreto nº 12.807/2025")),
  "canonicalização: Decreto nº 12.807/2025 permanece na Base legal",
);
check(
  procurementOfficial.filter((item) => item.title.includes("Portal TCU")).length === 1,
  "canonicalização: páginas equivalentes do TCU viram uma única fonte descritiva",
);
check(
  procurementOfficial.some((item) => item.title.includes("Portal Compras.gov.br")),
  "canonicalização: Compras.gov.br recebe título temático descritivo",
);
check(
  procurementReferences.every((item) => !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(item.title)),
  "canonicalização: nenhum título final é somente um domínio",
);

const principles = canonicalizeGovernanceV2References({
  question: "Explique os princípios constitucionais da administração pública.",
  baseReferences: [
    reference("Constituição Federal de 1988 — art. 37", "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm"),
    reference("Lei nº 9.784/1999", "https://www.planalto.gov.br/ccivil_03/leis/l9784.htm"),
  ],
  includeOfficialWebSources: false,
  officialWebSources: [],
});
check(
  principles.length === 1 && principles[0]?.title.includes("art. 37"),
  "canonicalização: princípios constitucionais mantêm somente a referência central",
);

const irrf = canonicalizeGovernanceV2References({
  question: "O Município pode ficar com o IRRF retido dos pagamentos realizados?",
  baseReferences: [
    reference("Constituição Federal de 1988 — art. 158, I", "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm"),
    reference("STF Tema 1130", "https://portal.stf.jus.br/jurisprudenciaRepercussao/verAndamentoProcesso.asp?numeroTema=1130"),
    reference("portal.stf.jus.br", "https://portal.stf.jus.br/jurisprudenciaRepercussao/verAndamentoProcesso.asp?numeroTema=1130"),
  ],
  includeOfficialWebSources: false,
  officialWebSources: [],
});
check(
  irrf.length === 2 && irrf.some((item) => item.title.includes("art. 158, I")) && irrf.some((item) => item.title.includes("Tema 1.130")),
  "canonicalização: IRRF mantém Constituição e Tema 1.130 sem duplicação",
);

const forbiddenRouteImports = [
  "@/lib/governance-v2",
  "@/lib/governance/chat/decision-policy",
  "@/lib/governance/chat/evidence-bundle",
];
const route = fs.readFileSync("src/app/api/governance/chat/route.ts", "utf8");
check(route.includes('from "@/lib/governance-core"'), "arquitetura: rota ativa usa governance-core");
for (const forbidden of forbiddenRouteImports) {
  check(!route.includes(forbidden), `arquitetura: rota ativa não importa ${forbidden}`);
}
check(!fs.existsSync("src/lib/governance-v2"), "arquitetura: diretório governance-v2 não existe no fluxo ativo");

const metadata = fs.readFileSync("src/lib/governance/chat/assistant-message-metadata.ts", "utf8");
const governanceResultContract = fs.readFileSync(
  "src/lib/governance/chat/governance-result.ts",
  "utf8",
);
check(metadata.includes("governance_result"), "persistência: snapshot governance_result permanece ativo");
check(governanceResultContract.includes("legal_references"), "persistência: Base legal é persistida separadamente");
check(governanceResultContract.includes("evidence_sources"), "persistência: evidências são persistidas separadamente");
check(
  governanceResultContract.includes("consultation_channels"),
  "persistência: canais de consulta são persistidos separadamente",
);

const essentialList = fs.readFileSync("src/app/essencial/chat/components/ChatMessagesList.tsx", "utf8");
const essentialAlternative = fs.readFileSync("src/app/essencial/chat/components/ChatMessages.tsx", "utf8");
const css = fs.readFileSync("src/app/globals.css", "utf8");
check(essentialList.includes("publia-footnote--essential"), "Essencial: renderer principal usa classe exclusiva do rodapé");
check(essentialAlternative.includes("publia-footnote--essential"), "Essencial: renderer alternativo usa classe exclusiva do rodapé");
check(/\.publia-footnote--essential[\s\S]{0,220}font-size:\s*14px\s*!important/.test(css), "Essencial: rodapé mantém 14px");
check(css.includes("text-size-adjust: 100% !important"), "Essencial: ajuste automático de texto permanece neutralizado");

const baselinePath = path.resolve("docs/governance-baseline-v15.17.json");
check(fs.existsSync(baselinePath), "baseline: manifesto versionado existe");
if (fs.existsSync(baselinePath)) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")) as {
    version?: string;
    scope?: string[];
    knownLimitations?: string[];
  };
  check(baseline.version === "15.17", "baseline: versão registrada como 15.16");
  check((baseline.scope?.length ?? 0) >= 5, "baseline: escopo funcional documentado");
  check((baseline.knownLimitations?.length ?? 0) >= 2, "baseline: limitações conhecidas documentadas");
}


// v15.8 — contrato único e compartilhado do snapshot.
const client = fs.readFileSync(
  "src/app/governanca/chat/GovernanceChatClient.tsx",
  "utf8",
);
const metadataBuilder = fs.readFileSync(
  "src/lib/governance/chat/assistant-message-metadata.ts",
  "utf8",
);
const observability = fs.readFileSync(
  "src/lib/governance/chat/request-observability.ts",
  "utf8",
);
const snapshotContract = fs.readFileSync(
  "src/lib/governance/chat/governance-result.ts",
  "utf8",
);

check(
  client.includes("parseGovernanceResultSnapshot") &&
    client.includes("flattenGovernanceResultReferences"),
  "persistência v15.16: cliente usa o parser compartilhado do snapshot",
);
check(
  metadataBuilder.includes("buildGovernanceResultSnapshot"),
  "persistência v15.16: backend usa o builder compartilhado do snapshot",
);
check(
  GOVERNANCE_RESULT_SNAPSHOT_VERSION === GOVERNANCE_CORE_VERSION,
  "persistência: contrato do snapshot acompanha a versão central",
);
check(
  GOVERNANCE_PIPELINE_VERSION.includes(GOVERNANCE_CORE_VERSION),
  "observabilidade: pipeline acompanha a versão central",
);

const builtSnapshot = buildGovernanceResultSnapshot({
  references: [
    reference(
      "Constituição Federal de 1988 — art. 37, caput",
      "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
      "legal",
    ),
    reference(
      "Plano de cargos, carreiras e vencimentos dos servidores municipais",
      "/api/governance/institutional-documents?action=open&documentId=doc-1",
      "institutional",
    ),
    reference(
      "Portal da Transparência",
      "https://municipio.example/transparencia",
      "consultation",
    ),
  ],
  evidenceStatus: "sufficient",
});

check(
  builtSnapshot.legal_references.length === 1 &&
    builtSnapshot.evidence_sources.length === 1 &&
    builtSnapshot.consultation_channels.length === 1,
  "persistência v15.16: builder separa Base legal, evidências e canais",
);

const parsedSnapshot = parseGovernanceResultSnapshot({
  governance_result: {
    ...builtSnapshot,
    legal_references: [
      ...builtSnapshot.legal_references,
      builtSnapshot.legal_references[0],
      { title: "", url: "https://invalid.example" },
    ],
  },
});

check(
  parsedSnapshot !== null &&
    parsedSnapshot.legal_references.length === 1,
  "persistência v15.16: parser remove duplicações e itens inválidos",
);

const flattened = parsedSnapshot
  ? flattenGovernanceResultReferences(parsedSnapshot)
  : [];

check(
  flattened.map((item) => item.kind).join("|") ===
    "legal|institutional|consultation",
  "persistência v15.16: reidratação preserva a categoria de cada referência",
);

check(
  parseGovernanceResultSnapshot({ references: [] }) === null,
  "persistência v15.16: parser não confunde metadata legado com snapshot novo",
);


const routeSourceV1510 = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/governance/chat/route.ts"),
  "utf8",
);
const orchestratorSourceV1510 = fs.readFileSync(
  path.join(process.cwd(), "src/lib/governance-core/orchestrator.ts"),
  "utf8",
);

check(GOVERNANCE_CORE_VERSION === "15.20", "versão central do core é 15.20");
check(
  routeSourceV1510.includes("queryPlan: governancePlan"),
  "rota entrega ao orquestrador o mesmo plano usado nas demais decisões",
);
check(
  !routeSourceV1510.includes('pipeline: "governance-core-v15.3"'),
  "rota não registra versão antiga fixa na telemetria",
);
check(
  orchestratorSourceV1510.includes("params.queryPlan ?? buildGovernanceV2QueryPlan(params.question)"),
  "orquestrador reutiliza o plano recebido e mantém fallback compatível",
);


check(
  (routeSourceV1510.match(/finalizeGovernanceCoreResponse\(/g) ?? []).length === 1 &&
    routeSourceV1510.includes("const finalizeGeneratedResponse"),
  "finalização canônica é definida uma única vez para respostas streaming e não streaming",
);
check(
  (routeSourceV1510.match(/finalizeGeneratedResponse\(assistantText\)/g) ?? []).length === 2,
  "streaming e não streaming reutilizam a mesma finalização",
);
check(
  (routeSourceV1510.match(/generateSuggestions\(\{/g) ?? []).length === 1 &&
    routeSourceV1510.includes("const generateGovernanceSuggestions"),
  "política de sugestões é definida uma única vez",
);
check(
  routeSourceV1510.includes('suppress: governancePlan.intent === "official_gazette"'),
  "supressão de sugestões do Diário Oficial vale para todos os caminhos de entrega",
);
check(
  (routeSourceV1510.match(/generateGovernanceSuggestions\(assistantText\)/g) ?? []).length >= 5,
  "caminhos persistidos e transitórios reutilizam a mesma política de sugestões",
);


const metadataSourceV1511 = fs.readFileSync(
  path.join(process.cwd(), "src/lib/governance/chat/assistant-message-metadata.ts"),
  "utf8",
);

check(
  metadataSourceV1511.includes("governance_result: buildGovernanceResultSnapshot"),
  "persistência v15.16: mensagens novas gravam o snapshot canônico",
);
check(
  !metadataSourceV1511.includes("    sources: responseSources,") &&
    (metadataSourceV1511.match(/^    references,$/gm) ?? []).length === 1,
  "persistência v15.16: metadata não grava cópias legadas de fontes e referências",
);
check(
  !metadataSourceV1511.includes("official_legal_references_used") &&
    !metadataSourceV1511.includes("institutional_sources_used") &&
    !metadataSourceV1511.includes("official_sources_used") &&
    !metadataSourceV1511.includes("official_gazette_reference_links"),
  "persistência v15.16: arrays legados específicos foram removidos das mensagens novas",
);
check(
  metadataSourceV1511.includes("reference_diagnostics") &&
    metadataSourceV1511.includes("legal_count") &&
    metadataSourceV1511.includes("official_gazette_count"),
  "persistência v15.16: telemetria mantém apenas contagens diagnósticas",
);



const transientResponseSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/governance/chat/transient-response.ts"),
  "utf8",
);
const infrastructureSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/governance/chat/infrastructure.ts"),
  "utf8",
);

check(
  infrastructureSource.includes("governance_result: buildGovernanceResultSnapshot"),
  "resposta transitória v15.16: mensagem não persistida também carrega snapshot canônico",
);
check(
  infrastructureSource.includes("pipeline_version: GOVERNANCE_PIPELINE_VERSION"),
  "resposta transitória v15.16: mensagem não persistida registra a versão do pipeline",
);
check(
  transientResponseSource.includes("references: params.references"),
  "resposta transitória v15.16: referências finalizadas são entregues ao builder da mensagem",
);
check(
  infrastructureSource.includes('evidenceStatus: params.evidenceStatus ?? "transient"'),
  "resposta transitória v15.16: snapshot identifica explicitamente ausência de persistência",
);
check(
  !infrastructureSource.includes("metadata: {\n      source: \"openai\",\n      product_tier: \"governance\",\n      response_mode"),
  "resposta transitória v15.16: metadata não permanece no formato antigo sem snapshot",
);



const persistedPayloadSourceV1513 = fs.readFileSync(
  path.join(process.cwd(), "src/lib/governance/chat/response-payload.ts"),
  "utf8",
);
const transientPayloadSourceV1513 = fs.readFileSync(
  path.join(process.cwd(), "src/lib/governance/chat/transient-response.ts"),
  "utf8",
);

check(
  !persistedPayloadSourceV1513.includes("sources: params.sources") &&
    !persistedPayloadSourceV1513.includes("references: params.references"),
  "envelope v15.16: resposta persistida não duplica fontes ou referências fora da mensagem",
);
check(
  !transientPayloadSourceV1513.includes("sources: params.sources") &&
    !/\n    references: params\.references,\n    persistenceSkipped/.test(transientPayloadSourceV1513),
  "envelope v15.16: resposta transitória não expõe cópias de referências no nível superior",
);
check(
  transientPayloadSourceV1513.includes("references: params.references") &&
    transientPayloadSourceV1513.includes("assistantMessage: buildTransientAssistantMessage"),
  "envelope v15.16: referências transitórias continuam entrando no snapshot da mensagem",
);
check(
  !routeSourceV1510.includes("sources: finalResponseSources") &&
    (routeSourceV1510.match(/buildGovernancePersistedResponsePayload\(\{/g) ?? []).length >= 4,
  "envelope v15.16: streaming, não streaming e recuperação idempotente usam a mensagem canônica",
);


check(
  parseGovernanceResultSnapshot({
    governance_result: {
      version: "15.16",
      legal_references: [],
      evidence_sources: [],
      consultation_channels: [],
      evidence_status: "insufficient",
    },
  }) !== null,
  "snapshot v15.16: contrato completo e legitimamente vazio permanece válido",
);

check(
  parseGovernanceResultSnapshot({
    governance_result: {
      version: "15.16",
      legal_references: [],
      evidence_status: "sufficient",
    },
    references: [reference("Referência legada", null, "legal")],
  }) === null,
  "snapshot v15.16: objeto parcial não bloqueia fallback legado do cliente",
);

check(
  parseGovernanceResultSnapshot({
    governance_result: {
      legal_references: [],
      evidence_sources: [],
      consultation_channels: [],
      evidence_status: "sufficient",
    },
  }) === null,
  "snapshot v15.16: versão ausente invalida o contrato",
);

check(
  parseGovernanceResultSnapshot({
    governance_result: {
      version: "15.16",
      legal_references: {},
      evidence_sources: [],
      consultation_channels: [],
      evidence_status: "sufficient",
    },
  }) === null,
  "snapshot v15.16: coleções malformadas invalidam o contrato",
);

const routeSourceV1515 = fs.readFileSync(
  path.resolve("src/app/api/governance/chat/route.ts"),
  "utf8",
);

const trustedPersistenceIndex = routeSourceV1515.indexOf(
  "const trustedAssistantSupabase = createServiceRoleSupabaseClient();",
);
const saveUserMessageIndex = routeSourceV1515.indexOf(
  "saveGovernanceUserMessage({",
);
const officialWebResearchIndex = routeSourceV1515.indexOf(
  "buildGovernanceEvidenceContext({",
);

check(
  trustedPersistenceIndex >= 0,
  "persistência v15.16: cliente confiável é validado explicitamente",
);
check(
  (routeSourceV1515.match(/const trustedAssistantSupabase = createServiceRoleSupabaseClient\(\);/g) ?? []).length === 1,
  "persistência v15.16: existe uma única criação do cliente confiável por requisição",
);
check(
  trustedPersistenceIndex >= 0 && trustedPersistenceIndex < saveUserMessageIndex,
  "persistência v15.16: service role é validada antes de salvar a mensagem do usuário",
);
check(
  trustedPersistenceIndex >= 0 && trustedPersistenceIndex < officialWebResearchIndex,
  "persistência v15.16: falha de configuração interrompe a requisição antes da pesquisa externa",
);
check(
  routeSourceV1515.indexOf("GOVERNANCE_CHAT_TRUSTED_PERSISTENCE_UNAVAILABLE") < saveUserMessageIndex,
  "persistência v15.16: resposta 503 ocorre antes de qualquer gravação de mensagem",
);

const idempotencySourceV1516 = fs.readFileSync(
  path.resolve("src/lib/governance/chat/idempotency.ts"),
  "utf8",
);
const routeSourceV1516 = fs.readFileSync(
  path.resolve("src/app/api/governance/chat/route.ts"),
  "utf8",
);

check(
  idempotencySourceV1516.includes('status: "completed"') &&
    idempotencySourceV1516.includes('assistantMessage: assistantData as GovernanceMessage'),
  "idempotência v15.16: requisição concluída recupera também a mensagem do assistente",
);
check(
  idempotencySourceV1516.includes('.eq("role", "assistant")') &&
    idempotencySourceV1516.includes('.eq("metadata->>client_request_id", clientRequestId)'),
  "idempotência v15.16: resposta recuperada usa a mesma chave idempotente",
);
check(
  routeSourceV1516.includes('idempotencyDecision.status === "completed"') &&
    routeSourceV1516.includes('x-governance-idempotency", "recovered"'),
  "idempotência v15.16: retry concluído retorna HTTP 200 com envelope canônico",
);
check(
  routeSourceV1516.includes('idempotencyDecision.status === "in_progress"') &&
    routeSourceV1516.includes('GOVERNANCE_CHAT_REQUEST_IN_PROGRESS') &&
    routeSourceV1516.includes('response.headers.set("retry-after", "3")'),
  "idempotência v15.16: requisição ainda em execução continua protegida por 409",
);
check(
  routeSourceV1516.includes('buildGovernancePersistedResponsePayload({') &&
    routeSourceV1516.includes('assistantMessage: idempotencyDecision.assistantMessage') &&
    routeSourceV1516.includes('suggestions: []'),
  "idempotência v15.16: recuperação reutiliza o contrato persistido sem regenerar conteúdo",
);

const routeSourceV1517 = fs.readFileSync(
  path.resolve("src/app/api/governance/chat/route.ts"),
  "utf8",
);

const persistUserMessageIndexV1517 = routeSourceV1517.indexOf(
  '"persist_user_message"',
);
const externalResearchIndexV1517 = routeSourceV1517.indexOf(
  "buildGovernanceEvidenceContext({",
);
const queryDecisionIndexV1517 = routeSourceV1517.indexOf(
  'telemetry.mark("query_decision"',
);

check(
  persistUserMessageIndexV1517 >= 0 &&
    persistUserMessageIndexV1517 < externalResearchIndexV1517,
  "idempotência v15.17: mensagem e chave idempotente são persistidas antes da pesquisa oficial",
);
check(
  persistUserMessageIndexV1517 >= 0 &&
    persistUserMessageIndexV1517 < queryDecisionIndexV1517,
  "idempotência v15.17: somente a requisição vencedora avança para o plano e trabalho externo",
);
check(
  routeSourceV1517.includes('"idempotency_conflict_recheck"') &&
    routeSourceV1517.includes('duplicateDecision.status === "completed"'),
  "idempotência v15.17: conflito transacional é reavaliado antes da resposta ao cliente",
);
check(
  routeSourceV1517.includes('"recovered-after-conflict"') &&
    routeSourceV1517.includes('"in-progress-after-conflict"'),
  "idempotência v15.17: corrida distingue resposta concluída de processamento em andamento",
);

const responseModeUpdateIndexV1517 = routeSourceV1517.indexOf(
  "updateGovernanceConversationResponseMode({",
);
check(
  persistUserMessageIndexV1517 >= 0 &&
    persistUserMessageIndexV1517 < responseModeUpdateIndexV1517,
  "idempotência v15.17: requisição concorrente perdedora não altera o modo da conversa",
);
check(
  routeSourceV1517.includes('idempotencyDecision.status === "stale"') &&
    routeSourceV1517.includes('"idempotency_stale_reclaim"'),
  "idempotência v15.18: requisição sem resposta pode expirar e entrar em recuperação controlada",
);

const idempotencySourceV1518 = fs.readFileSync(
  path.resolve("src/lib/governance/chat/idempotency.ts"),
  "utf8",
);
const persistenceSourceV1518 = fs.readFileSync(
  path.resolve("src/lib/governance/chat/persistence.ts"),
  "utf8",
);

check(
  idempotencySourceV1518.includes('status: "stale"') &&
    idempotencySourceV1518.includes("resolveGovernanceIdempotencyLeaseSeconds"),
  "idempotência v15.18: estado em processamento possui lease configurável e deixa de ficar preso indefinidamente",
);
check(
  persistenceSourceV1518.includes('processing_status: "processing"') &&
    persistenceSourceV1518.includes("processing_started_at") &&
    persistenceSourceV1518.includes("processing_attempt_id") &&
    persistenceSourceV1518.includes("processing_attempt_count: 1"),
  "idempotência v15.18: nova mensagem registra lease e identidade da tentativa",
);
check(
  idempotencySourceV1518.includes("reclaimStaleGovernanceRequest") &&
    idempotencySourceV1518.includes('processing_reclaimed_at') &&
    idempotencySourceV1518.includes('.eq("metadata->>processing_attempt_id", previousAttemptId)'),
  "idempotência v15.18: recuperação usa troca atômica do identificador da tentativa",
);
check(
  routeSourceV1517.includes("GOVERNANCE_CHAT_IDEMPOTENCY_PAYLOAD_MISMATCH") &&
    routeSourceV1517.includes("idempotencyDecision.userMessage.content !== content"),
  "idempotência v15.18: chave expirada não pode ser reutilizada com conteúdo diferente",
);
check(
  routeSourceV1517.includes('"recovered-after-stale-race"') &&
    routeSourceV1517.includes('"in-progress-after-stale-race"'),
  "idempotência v15.18: corrida de recuperação distingue conclusão de novo processamento",
);
check(
  routeSourceV1517.indexOf('"idempotency_stale_reclaim"') <
    routeSourceV1517.indexOf('telemetry.mark("query_decision"'),
  "idempotência v15.18: lease é conquistado antes de pesquisa, evidências e OpenAI",
);

const originalLease = process.env.GOVERNANCE_IDEMPOTENCY_LEASE_SECONDS;
delete process.env.GOVERNANCE_IDEMPOTENCY_LEASE_SECONDS;
check(
  resolveGovernanceIdempotencyLeaseSeconds() === 300,
  "idempotência v15.18: lease padrão é de 300 segundos",
);
process.env.GOVERNANCE_IDEMPOTENCY_LEASE_SECONDS = "5";
check(
  resolveGovernanceIdempotencyLeaseSeconds() === 30,
  "idempotência v15.18: lease configurado respeita mínimo seguro de 30 segundos",
);
process.env.GOVERNANCE_IDEMPOTENCY_LEASE_SECONDS = "9999";
check(
  resolveGovernanceIdempotencyLeaseSeconds() === 1800,
  "idempotência v15.18: lease configurado respeita máximo de 1800 segundos",
);
if (originalLease === undefined) {
  delete process.env.GOVERNANCE_IDEMPOTENCY_LEASE_SECONDS;
} else {
  process.env.GOVERNANCE_IDEMPOTENCY_LEASE_SECONDS = originalLease;
}

const assistantIdempotencyMigration = fs.readFileSync(
  path.resolve("supabase/migrations/202607280001_621_governance_assistant_idempotency.sql"),
  "utf8",
);
const assistantPersistenceSourceV1519 = fs.readFileSync(
  path.resolve("src/lib/governance/chat/persistence.ts"),
  "utf8",
);

check(
  assistantIdempotencyMigration.includes("uq_governance_messages_assistant_client_request") &&
    assistantIdempotencyMigration.includes("where role = 'assistant'"),
  "idempotência v15.20: banco impede duas respostas do assistente para a mesma requisição",
);
check(
  assistantIdempotencyMigration.includes("ranked_duplicates") &&
    assistantIdempotencyMigration.includes("metadata = gm.metadata - 'client_request_id'"),
  "idempotência v15.20: duplicidades históricas são saneadas sem apagar respostas",
);
check(
  assistantPersistenceSourceV1519.includes('postgresError?.code === "23505"') &&
    assistantPersistenceSourceV1519.includes('.eq("role", "assistant")') &&
    assistantPersistenceSourceV1519.includes('.eq("metadata->>client_request_id", clientRequestId)'),
  "idempotência v15.20: conflito do assistente recupera a resposta já persistida",
);
check(
  assistantPersistenceSourceV1519.includes("duplicate: true") &&
    assistantPersistenceSourceV1519.includes("duplicate: false"),
  "idempotência v15.20: saver distingue inserção nova de recuperação idempotente",
);
check(
  fs.existsSync(path.resolve("supabase/rollback/202607280001_621_governance_assistant_idempotency.rollback.sql")),
  "idempotência v15.20: migration possui rollback explícito",
);

check(
  GOVERNANCE_CORE_VERSION === "15.20" &&
    GOVERNANCE_PIPELINE_VERSION ===
      "governance-v15.20-final-audit-closure" &&
    GOVERNANCE_RESULT_SNAPSHOT_VERSION === "15.20",
  "versionamento v15.20: core, pipeline e snapshot estão alinhados",
);



function readClosureFile(file: string) {
  return fs.readFileSync(file, "utf8");
}

function walkClosureFiles(directory: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkClosureFiles(target));
    } else {
      result.push(target);
    }
  }
  return result;
}

const activeRouteSource = readClosureFile("src/app/api/governance/chat/route.ts");
const activeClientSource = readClosureFile("src/app/governanca/chat/GovernanceChatClient.tsx");
const runtimeSourceFiles = walkClosureFiles("src").filter((file) => /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file));
const forbiddenLegacyImports = [
  "@/lib/governance/knowledge-engine",
  "@/lib/governance/recovery/orchestrator",
  "@/lib/governance/chat/decision-policy",
  "@/lib/governance/chat/evidence-bundle",
  "@/lib/governance/chat/initial-response-sources",
  "@/lib/governance/chat/official-gazette-context",
  "@/lib/governance/chat/official-legal-references",
  "@/lib/governance/chat/reference-filter",
  "@/lib/governance/chat/response-finalization",
  "@/lib/governance/chat/unified-response-policy",
];

check(
  forbiddenLegacyImports.every((specifier) => !activeRouteSource.includes(specifier)),
  "encerramento v15.20: rota principal permanece isolada dos módulos legados substituídos",
);
check(
  activeRouteSource.includes("@/lib/governance-core") &&
    activeRouteSource.includes("createGovernanceAssistantMessageMetadataBuilder") &&
    readClosureFile("src/lib/governance/chat/assistant-message-metadata.ts").includes("buildGovernanceResultSnapshot"),
  "encerramento v15.20: rota usa core e snapshot canônicos",
);
check(
  activeClientSource.includes("parseGovernanceResultSnapshot") &&
    activeClientSource.includes("flattenGovernanceResultReferences"),
  "encerramento v15.20: cliente reidrata exclusivamente pelo contrato compartilhado quando disponível",
);
check(
  runtimeSourceFiles.every((file) => !/\.bak(?:\.|$)/i.test(file)),
  "encerramento v15.20: backups não são tratados como arquivos de runtime",
);
check(
  runtimeSourceFiles.every((file) => {
    const source = readClosureFile(file);
    return !/from\s+["'][^"']*\.bak(?:\.[^"']*)?["']|import\(["'][^"']*\.bak(?:\.[^"']*)?["']\)/i.test(source);
  }),
  "encerramento v15.20: nenhum módulo ativo importa backups",
);
check(
  fs.existsSync("README-ENCERRAMENTO-GOVERNANCA-V15.20.txt") &&
    fs.existsSync("docs/governance-final-audit-v15.20.json"),
  "encerramento v15.20: relatório final e manifesto de auditoria existem",
);

console.log(`\nGovernança v15.20: ${checks - failures}/${checks} verificações aprovadas.`);
if (failures > 0) process.exit(1);
