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

const baselinePath = path.resolve("docs/governance-baseline-v15.11.json");
check(fs.existsSync(baselinePath), "baseline: manifesto versionado existe");
if (fs.existsSync(baselinePath)) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")) as {
    version?: string;
    scope?: string[];
    knownLimitations?: string[];
  };
  check(baseline.version === "15.11", "baseline: versão registrada como 15.11");
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
  "persistência v15.11: cliente usa o parser compartilhado do snapshot",
);
check(
  metadataBuilder.includes("buildGovernanceResultSnapshot"),
  "persistência v15.11: backend usa o builder compartilhado do snapshot",
);
check(
  GOVERNANCE_RESULT_SNAPSHOT_VERSION === "15.11",
  "persistência v15.11: contrato versionado em 15.11",
);
check(
  GOVERNANCE_PIPELINE_VERSION === "governance-v15.11-canonical-metadata",
  "observabilidade v15.11: pipeline identifica conclusão unificada",
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
  "persistência v15.11: builder separa Base legal, evidências e canais",
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
  "persistência v15.11: parser remove duplicações e itens inválidos",
);

const flattened = parsedSnapshot
  ? flattenGovernanceResultReferences(parsedSnapshot)
  : [];

check(
  flattened.map((item) => item.kind).join("|") ===
    "legal|institutional|consultation",
  "persistência v15.11: reidratação preserva a categoria de cada referência",
);

check(
  parseGovernanceResultSnapshot({ references: [] }) === null,
  "persistência v15.11: parser não confunde metadata legado com snapshot novo",
);


const routeSourceV1510 = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/governance/chat/route.ts"),
  "utf8",
);
const orchestratorSourceV1510 = fs.readFileSync(
  path.join(process.cwd(), "src/lib/governance-core/orchestrator.ts"),
  "utf8",
);

check(GOVERNANCE_CORE_VERSION === "15.11", "versão central do core é 15.11");
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
  "persistência v15.11: mensagens novas gravam o snapshot canônico",
);
check(
  !metadataSourceV1511.includes("    sources: responseSources,") &&
    (metadataSourceV1511.match(/^    references,$/gm) ?? []).length === 1,
  "persistência v15.11: metadata não grava cópias legadas de fontes e referências",
);
check(
  !metadataSourceV1511.includes("official_legal_references_used") &&
    !metadataSourceV1511.includes("institutional_sources_used") &&
    !metadataSourceV1511.includes("official_sources_used") &&
    !metadataSourceV1511.includes("official_gazette_reference_links"),
  "persistência v15.11: arrays legados específicos foram removidos das mensagens novas",
);
check(
  metadataSourceV1511.includes("reference_diagnostics") &&
    metadataSourceV1511.includes("legal_count") &&
    metadataSourceV1511.includes("official_gazette_count"),
  "persistência v15.11: telemetria mantém apenas contagens diagnósticas",
);

console.log(`\nGovernança v15.11: ${checks - failures}/${checks} verificações aprovadas.`);
if (failures > 0) process.exit(1);
