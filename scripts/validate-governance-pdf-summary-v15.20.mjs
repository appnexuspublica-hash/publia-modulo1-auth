import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "src/app/api/governance/chat/route.ts"), "utf8");
const context = fs.readFileSync(path.join(root, "src/lib/governance/chat/pdf-context.ts"), "utf8");
const summary = fs.readFileSync(path.join(root, "src/lib/governance/chat/pdf-summary.ts"), "utf8");

const checks = [
  ["rota detecta resumo de PDFs selecionados", route.includes("isSelectedPdfSummaryRequest")],
  ["rota envia summaryRequested ao contexto", route.includes("summaryRequested: isSelectedPdfSummaryRequest")],
  ["rota proíbe observação genérica quando cobertura é integral", route.includes("Não diga que apenas alguns trechos foram acessados")],
  ["contexto ignora busca vetorial no modo resumo", context.includes("if (params.summaryRequested)")],
  ["contexto usa resumo hierárquico", context.includes("buildGovernancePdfHierarchicalSummary")],
  ["resumo processa o texto extraído sequencialmente", summary.includes("splitTextForSummary")],
  ["resumo possui consolidação final", summary.includes("Consolide resumos parciais sequenciais")],
  ["limitação é emitida apenas quando cobertura é parcial", summary.includes("coverageComplete")],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERRO"}: ${label}`);
  failed ||= !ok;
}

if (failed) process.exit(1);
console.log("\nResumo hierárquico de PDFs: validação estrutural aprovada.");
