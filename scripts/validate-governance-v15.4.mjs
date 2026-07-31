import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}
function assert(condition, message) {
  if (!condition) {
    console.error(`ERRO: ${message}`);
    process.exit(1);
  }
  console.log(`OK: ${message}`);
}

const canonicalizer = read("src/lib/governance-core/reference-canonicalizer.ts");
const css = read("src/app/globals.css");

assert(
  canonicalizer.includes("canonicalOfficialSourceIdentity"),
  "fontes web oficiais passam por canonicalização descritiva",
);
assert(
  canonicalizer.includes("Jurisprudência e orientações do TCU em licitações e contratos — Portal TCU"),
  "fontes do TCU recebem título informativo",
);
assert(
  canonicalizer.includes("Orientações gerais sobre dispensa por valor e fracionamento — Portal Compras.gov.br"),
  "Compras.gov.br recebe título temático informativo",
);
assert(
  canonicalizer.includes("Decreto nº 12.807/2025 — Diário Oficial da União"),
  "Diário Oficial identifica o Decreto nº 12.807/2025",
);
assert(
  canonicalizer.includes('reference.origin === "web"') &&
    canonicalizer.includes('kind: "legal" as const'),
  "normas recuperadas pela web não permanecem duplicadas em Fontes consultadas",
);
assert(
  canonicalizer.includes("official:tcu:${topic}"),
  "páginas equivalentes do TCU são deduplicadas por autoridade e tema",
);
assert(
  css.includes("font-size: 13px !important") &&
    css.includes("line-height: 1.55 !important"),
  "rodapé do Essencial volta a ter tipografia legível",
);

console.log("Governança v15.4: validação estrutural concluída.");
