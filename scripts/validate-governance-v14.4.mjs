import fs from 'node:fs';

const checks = [
  ['canonicalizador jurídico', 'src/lib/governance-v2/reference-canonicalizer.ts', 'canonicalizeGovernanceV2References'],
  ['identidade Constituição art. 37', 'src/lib/governance-v2/reference-canonicalizer.ts', 'cf:1988:art-37'],
  ['identidade STF Tema 1130', 'src/lib/governance-v2/reference-canonicalizer.ts', 'stf:tema-1130'],
  ['canais com tipo consultation', 'src/lib/governance-v2/orchestrator.ts', '"consultation"'],
  ['seção de canais no cliente', 'src/app/governanca/chat/GovernanceChatClient.tsx', 'Canais oficiais para consulta'],
  ['busca institucional com extracted_text', 'src/lib/governance-v2/providers/institutional.ts', 'fallback_from_extracted_text'],
  ['URL institucional estável', 'src/lib/governance-v2/providers/institutional.ts', '/api/governance/institutional-documents?action=open'],
  ['concurso sem portal de transparência', 'src/lib/governance-v2/providers/official-sources.ts', 'const max = params.plan.intent === "financial_fact" ? 2 : contest ? 2 : 4'],
  ['resposta numérica direta', 'src/app/api/governance/chat/route.ts', 'FORMATO OBRIGATÓRIO V2 — RESPOSTA NUMÉRICA'],
  ['resposta sim ou não direta', 'src/app/api/governance/chat/route.ts', 'FORMATO OBRIGATÓRIO V2 — SIM OU NÃO'],
];

let failed = false;
for (const [label, file, needle] of checks) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(needle)) {
    console.error(`FALHA: ${label}`);
    failed = true;
  } else {
    console.log(`OK: ${label}`);
  }
}

if (failed) process.exit(1);
console.log('Governança v14.4: validação estrutural concluída.');
