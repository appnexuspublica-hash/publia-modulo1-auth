import fs from "node:fs";
import path from "node:path";

import { buildGovernanceV2QueryPlan } from "../src/lib/governance-core/query-plan";
import { canonicalizeGovernanceV2References } from "../src/lib/governance-core/reference-canonicalizer";
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
check(metadata.includes("governance_result"), "persistência: snapshot governance_result permanece ativo");
check(metadata.includes("legal_references"), "persistência: Base legal é persistida separadamente");
check(metadata.includes("evidence_sources"), "persistência: evidências são persistidas separadamente");
check(metadata.includes("consultation_channels"), "persistência: canais de consulta são persistidos separadamente");

const essentialList = fs.readFileSync("src/app/essencial/chat/components/ChatMessagesList.tsx", "utf8");
const essentialAlternative = fs.readFileSync("src/app/essencial/chat/components/ChatMessages.tsx", "utf8");
const css = fs.readFileSync("src/app/globals.css", "utf8");
check(essentialList.includes("publia-footnote--essential"), "Essencial: renderer principal usa classe exclusiva do rodapé");
check(essentialAlternative.includes("publia-footnote--essential"), "Essencial: renderer alternativo usa classe exclusiva do rodapé");
check(/\.publia-footnote--essential[\s\S]{0,220}font-size:\s*14px\s*!important/.test(css), "Essencial: rodapé mantém 14px");
check(css.includes("text-size-adjust: 100% !important"), "Essencial: ajuste automático de texto permanece neutralizado");

const baselinePath = path.resolve("docs/governance-baseline-v15.7.json");
check(fs.existsSync(baselinePath), "baseline: manifesto versionado existe");
if (fs.existsSync(baselinePath)) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")) as {
    version?: string;
    scope?: string[];
    knownLimitations?: string[];
  };
  check(baseline.version === "15.7", "baseline: versão registrada como 15.7");
  check((baseline.scope?.length ?? 0) >= 5, "baseline: escopo funcional documentado");
  check((baseline.knownLimitations?.length ?? 0) >= 2, "baseline: limitações conhecidas documentadas");
}

// v15.7 — invariantes de persistência e reidratação.
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

check(
  client.includes("governance_result?:") &&
    client.includes("governanceResult.legal_references") &&
    client.includes("governanceResult.evidence_sources") &&
    client.includes("governanceResult.consultation_channels"),
  "persistência v15.7: cliente reidrata o snapshot governance_result",
);
check(
  client.indexOf("if (governanceResult && typeof governanceResult === \"object\")") <
    client.indexOf("const references = (metadata as { references?: unknown }).references"),
  "persistência v15.7: snapshot tem precedência sobre metadata.references",
);
check(
  metadataBuilder.includes('version: "15.7"'),
  "persistência v15.7: snapshot versionado em 15.7",
);
check(
  observability.includes("governance-v15.7-snapshot-rehydration"),
  "observabilidade v15.7: pipeline identifica reidratação por snapshot",
);


console.log(`\nGovernança v15.7: ${checks - failures}/${checks} verificações aprovadas.`);
if (failures > 0) process.exit(1);
