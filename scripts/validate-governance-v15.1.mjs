import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
function check(label, condition) {
  if (!condition) throw new Error(`FALHA: ${label}`);
  checks.push(label);
  console.log(`OK: ${label}`);
}

const topics = read("src/lib/governance-core/legal-topics.ts");
const legal = read("src/lib/governance-core/providers/legal.ts");
const institutional = read("src/lib/governance-core/providers/institutional.ts");
const canonicalizer = read("src/lib/governance-core/reference-canonicalizer.ts");
const route = read("src/app/api/governance/chat/route.ts");
const resolver = read("src/lib/official-web/resolver.ts");
const telemetry = read("src/lib/governance/chat/request-observability.ts");

check("pacote temático compartilhado de contratação direta", topics.includes('"procurement_direct_award"'));
check("valores de 2026 consolidados", topics.includes("R$ 130.984,20") && topics.includes("R$ 65.492,11"));
check("Decreto nº 12.807/2025 consolidado", topics.includes("Decreto nº 12.807/2025"));
check("fracionamento recebe limites vigentes", topics.includes("Em perguntas sobre dividir ou fracionar"));
check("provider legal usa Lei e Decreto no mesmo tema", legal.includes("decreto-12807-2025") && legal.includes("lei-14133"));
check("canonicalizador mantém Decreto em todo tema de dispensa", canonicalizer.includes('key === "lei:14133:2021" || key === "decreto:12807:2025"'));
check("pesquisa oficial reconhece fracionamento", resolver.includes("fracionamento|dividir a compra|limite de dispensa"));
check("documentos aprovados não dependem de indexing_status indexed", institutional.includes('.eq("review_status", "approved")') && !institutional.includes('.eq("indexing_status", "indexed")'));
check("chunks pendentes de documento aprovado podem ser recuperados", institutional.includes('.in("status", ["active", "pending_review"])'));
check("extracted_text participa sempre da seleção", institutional.includes("const extractedRows = splitExtractedText"));
check("busca institucional expande termos de progressão", institutional.includes("progressao funcional horizontal vertical"));
check("ausência institucional não gera resposta genérica", route.includes("Não descreva como planos semelhantes costumam funcionar"));
check("documento longo usa síntese por padrão", route.includes("no máximo 8 pontos essenciais"));
check("telemetria v15.1", telemetry.includes("governance-v15.1-thematic-core"));

console.log(`Governança v15.1: ${checks.length} validações concluídas.`);
