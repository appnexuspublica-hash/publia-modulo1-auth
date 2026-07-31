import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}
function assert(condition, label) {
  if (!condition) {
    console.error(`FALHA: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${label}`);
  }
}

const queryPlan = read("src/lib/governance-core/query-plan.ts");
const canonicalizer = read("src/lib/governance-core/reference-canonicalizer.ts");
const metadata = read("src/lib/governance/chat/assistant-message-metadata.ts");
const observability = read("src/lib/governance/chat/request-observability.ts");

assert(queryPlan.includes("o que\\b.{0,120}\\b(diz|estabelece|preve|determina|disciplina|regulamenta|trata)"), "perguntas 'o que o plano estabelece' entram na rota institucional");
assert(queryPlan.includes("plano de cargos|plano de carreira"), "Plano de Cargos e Magistério reconhecidos como objetos institucionais");
assert(canonicalizer.includes("requiredLegalReferencesForQuestion"), "invariantes de Base legal aplicadas após a geração");
assert(canonicalizer.includes("Decreto nº 12.807/2025 — atualização dos valores"), "Decreto nº 12.807/2025 obrigatório no tema de dispensa/fracionamento");
assert(canonicalizer.includes("varias dispensas"), "múltiplas dispensas do mesmo objeto compartilham o pacote jurídico");
assert(metadata.includes('version: "15.2"'), "snapshot governance_result versionado em 15.2");
assert(observability.includes("governance-v15.2-institutional-routing"), "telemetria identifica a v15.2");

if (process.exitCode) process.exit(process.exitCode);
console.log("Governança v15.2: validação estrutural concluída.");
