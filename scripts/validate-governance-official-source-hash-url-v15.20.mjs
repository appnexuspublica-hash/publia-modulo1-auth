import fs from "node:fs";

const canonicalizer = fs.readFileSync("src/lib/governance-core/reference-canonicalizer.ts", "utf8");
const collector = fs.readFileSync("src/lib/official-web/source-collector.ts", "utf8");

const checks = [
  [!canonicalizer.includes('parsed.hash = ""'), "canonicalizador não remove fragmentos da URL"],
  [!collector.includes('parsed.hash = ""'), "coletor oficial não remove fragmentos da URL"],
  [canonicalizer.includes("Betha Transparência"), "comentário documenta rota SPA do Betha"],
  [collector.includes("Preserve hash routes"), "coletor preserva rotas SPA oficiais"],
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "OK" : "FALHA"}: ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
