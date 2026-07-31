import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function assert(condition, message) {
  if (!condition) {
    console.error(`ERRO: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${message}`);
  }
}

const queryPlan = read('src/lib/governance-core/query-plan.ts');
const types = read('src/lib/governance-core/types.ts');
const route = read('src/app/api/governance/chat/route.ts');
const canonicalizer = read('src/lib/governance-core/reference-canonicalizer.ts');

assert(types.includes('"general_administrative"'), 'intenção geral administrativa explícita');
assert(queryPlan.includes('intent = "general_administrative"'), 'perguntas gerais não dependem de lista fechada de frases');
assert(route.includes('governancePlan.intent === "general_administrative"'), 'pesquisa oficial habilitada para perguntas gerais administrativas');
assert(canonicalizer.includes('canonicalNumberedNorm'), 'canonicalização genérica de normas numeradas');
assert(canonicalizer.includes('looksLikeNormativeOfficialSource'), 'separação entre base legal e fonte técnica oficial');
assert(canonicalizer.includes('Lei nº 5.172/1966 — Código Tributário Nacional'), 'Código Tributário Nacional reconhecido sem regra de pergunta exata');
assert(!queryPlan.includes('prompt de 1 a 8'), 'nenhuma regra vinculada ao roteiro de teste');

if (process.exitCode) process.exit(process.exitCode);
console.log('Governança v15.3: validação estrutural concluída.');
