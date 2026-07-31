import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const gazette = read("src/lib/governance/chat/official-gazette-context.ts");
const providers = read("src/lib/governance/knowledge-engine/providers.ts");
const context = read("src/lib/governance/knowledge-engine/context.ts");

assert(
  !gazette.includes("rows.slice(0, 20)"),
  "O fallback irrelevante do Diário Oficial ainda está presente.",
);
assert(
  gazette.includes('"no_relevant_match"'),
  "O diagnóstico de ausência de correspondência relevante não foi encontrado.",
);
assert(
  gazette.includes("irrelevantFallbackPrevented"),
  "O indicador de bloqueio do fallback irrelevante não foi encontrado.",
);
assert(
  providers.includes("shouldLoadOfficialSourcesDirectory"),
  "A política de uso das Fontes Oficiais como diretório não foi encontrada.",
);
assert(
  providers.includes('evidence_role: "directory_reference"'),
  "As Fontes Oficiais não estão marcadas como referência de diretório.",
);
assert(
  providers.includes("factual_evidence: false"),
  "As Fontes Oficiais não estão marcadas como não factuais.",
);
assert(
  context.includes("não é evidência factual"),
  "O contexto não diferencia referência de consulta e evidência factual.",
);
assert(
  context.toLowerCase().includes("nem afirme que o portal foi consultado"),
  "A proteção contra falsa alegação de consulta ao portal não foi encontrada.",
);

console.log("Validação v13.17 concluída: regras estruturais aplicadas.");
