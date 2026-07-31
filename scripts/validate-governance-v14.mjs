import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/lib/governance-v2/types.ts",
  "src/lib/governance-v2/query-plan.ts",
  "src/lib/governance-v2/orchestrator.ts",
  "src/lib/governance-v2/finalization.ts",
  "src/lib/governance-v2/providers/institutional.ts",
  "src/lib/governance-v2/providers/official-gazette.ts",
  "src/lib/governance-v2/providers/official-sources.ts",
  "src/lib/governance-v2/providers/legal.ts",
  "src/app/api/governance/chat/route.ts",
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Arquivo ausente: ${file}`);
}
const route = fs.readFileSync(path.join(root, "src/app/api/governance/chat/route.ts"), "utf8");
const orchestrator = fs.readFileSync(path.join(root, "src/lib/governance-v2/orchestrator.ts"), "utf8");
const finalization = fs.readFileSync(path.join(root, "src/lib/governance-v2/finalization.ts"), "utf8");
const gazette = fs.readFileSync(path.join(root, "src/lib/governance-v2/providers/official-gazette.ts"), "utf8");
const checks = [
  [route.includes('process.env.GOVERNANCE_PIPELINE_VERSION !== "legacy"'), "feature flag V2"],
  [route.includes("orchestrateGovernanceV2"), "orquestrador V2 integrado"],
  [route.includes("finalizeGovernanceV2Response"), "finalização V2 integrada"],
  [orchestrator.includes("requiredSatisfied"), "suficiência única"],
  [orchestrator.includes("PIPELINE DE EVIDÊNCIAS V2"), "contexto V2"],
  [!finalization.includes("buildOfficialLegalReferencesForGovernance"), "sem reconstrução normativa posterior"],
  [!finalization.includes("filterGovernanceChatReferencesForClient"), "sem filtro posterior por texto"],
  [!gazette.includes("slice(0, 20)"), "sem fallback aleatório do Diário"],
];
for (const [ok, label] of checks) {
  if (!ok) throw new Error(`Falha: ${label}`);
  console.log(`OK: ${label}`);
}
console.log("Governança v14.0: validação estrutural concluída.");
