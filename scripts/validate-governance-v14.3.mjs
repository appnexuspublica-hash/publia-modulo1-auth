import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const plan = read("src/lib/governance-v2/query-plan.ts");
const legal = read("src/lib/governance-v2/providers/legal.ts");
const route = read("src/app/api/governance/chat/route.ts");
const finalization = read("src/lib/governance-v2/finalization.ts");
const client = read("src/app/governanca/chat/GovernanceChatClient.tsx");

const checks = [
  ["licitação geral não força Diário Oficial", !/isDirectGazetteQuestion[\s\S]*?licitacao/.test(plan.split("function isFinancialFactQuestion")[0])],
  ["helper de conhecimento primário", plan.includes("isGovernanceV2KnowledgePrimaryQuestion")],
  ["IRRF coberto pela base legal", legal.includes("STF — Tema 1.130") && legal.includes("art. 158, I")],
  ["Lei 14.133 coberta", legal.includes("Lei nº 14.133/2021")],
  ["web oficial reativada somente para conhecimento primário", route.includes("governanceV2KnowledgePrimary") && route.includes("forceWebFirst =")],
  ["política explícita de precedência", route.includes("POLÍTICA DE PRECEDÊNCIA V2 — CONHECIMENTO PRIMÁRIO")],
  ["fontes web oficiais entram como base legal", finalization.includes("includeOfficialWebSources") && finalization.includes('kind: "legal"')],
  ["fallback de base legal no cliente", client.includes("official_legal_references_used")],
];

let failed = false;
for (const [label, ok] of checks) {
  if (ok) console.log(`OK: ${label}`);
  else {
    failed = true;
    console.error(`ERRO: ${label}`);
  }
}

if (failed) process.exit(1);
console.log("Governança v14.3: validação estrutural concluída.");
