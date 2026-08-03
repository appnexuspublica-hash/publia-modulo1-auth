import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "src/app/api/governance/chat/route.ts"), "utf8");
const context = fs.readFileSync(path.join(root, "src/lib/governance/chat/pdf-context.ts"), "utf8");
const summary = fs.readFileSync(path.join(root, "src/lib/governance/chat/pdf-summary.ts"), "utf8");

const checks = [
  ["rota detecta resumo de PDFs selecionados", route.includes("isSelectedPdfSummaryRequest")],
  ["rota envia summaryRequested ao contexto", route.includes("summaryRequested: isSelectedPdfSummaryRequest")],
  ["rota usa instrução de resumo adaptativo rápido", route.includes("MODO DE RESUMO ADAPTATIVO RÁPIDO")],
  ["contexto não chama resumo hierárquico antes da resposta", !context.includes("buildGovernancePdfHierarchicalSummary")],
  ["contexto prepara PDFs em paralelo", context.includes("const summaryResults = await Promise.all")],
  ["contexto usa fonte adaptativa local", context.includes("buildGovernancePdfAdaptiveSource")],
  ["resumo usa texto integral quando cabe", summary.includes('strategy: "full_text"')],
  ["resumo usa amostragem distribuída para conjuntos grandes", summary.includes('strategy: "distributed_sampling"')],
  ["amostragem preserva linhas estruturais", summary.includes("ADAPTIVE_PRIORITY_LINE_RE")],
  ["amostragem cobre posições distribuídas do documento", summary.includes("Trecho distribuído")],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERRO"}: ${label}`);
  failed ||= !ok;
}

if (failed) process.exit(1);
console.log("\nResumo adaptativo rápido de PDFs: validação estrutural aprovada.");
