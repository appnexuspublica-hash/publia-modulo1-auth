import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [
  ["src/app/api/governance/chat/route.ts", "!useGovernanceV2 &&", "web legado desativado no V2"],
  ["src/lib/governance-v2/orchestrator.ts", "item.provider === \"legal\"", "base legal preservada"],
  ["src/lib/governance-v2/orchestrator.ts", "document_title", "Diário Oficial vinculado ao ato"],
  ["src/lib/governance-v2/orchestrator.ts", "directory.slice", "fontes de consulta usadas apenas como fallback"],
  ["src/lib/governance-v2/providers/official-sources.ts", "slice(0, max)", "limite de diretórios oficiais"],
  ["src/lib/governance-v2/providers/institutional.ts", "documentLimit", "seleção institucional por documento"],
  ["src/lib/governance-v2/providers/official-gazette.ts", "sameAct", "ato exato validado"],
  ["src/lib/governance-v2/finalization.ts", "externalSources: []", "fontes web legadas excluídas"],
  ["src/app/governanca/chat/GovernanceChatClient.tsx", "Base legal", "seção Base legal renderizada"],
];

let failed = false;
for (const [relative, needle, label] of checks) {
  const file = path.join(root, relative);
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes(needle)) {
    failed = true;
    console.error(`FALHA: ${label} (${relative})`);
  } else {
    console.log(`OK: ${label}`);
  }
}

if (failed) process.exit(1);
console.log("Governança v14.1: validação estrutural concluída.");
