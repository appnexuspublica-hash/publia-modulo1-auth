import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const route = read('src/app/api/governance/chat/route.ts');
const client = read('src/app/governanca/chat/GovernanceChatClient.tsx');
const metadata = read('src/lib/governance/chat/assistant-message-metadata.ts');
const telemetry = read('src/lib/governance/chat/request-observability.ts');

const forbiddenRouteImports = [
  '@/lib/governance/knowledge-engine',
  '@/lib/governance/recovery',
  '@/lib/governance/chat/evidence-bundle',
  '@/lib/governance/chat/response-finalization',
  '@/lib/governance/chat/official-gazette-context',
  '@/lib/governance/chat/question-classifier',
  '@/lib/governance/chat/decision-policy',
];

const failures = [];
for (const item of forbiddenRouteImports) {
  if (route.includes(item)) failures.push(`rota ainda importa legado: ${item}`);
}
if (!route.includes('@/lib/governance-core')) failures.push('rota não usa governance-core');
if (!route.includes('orchestrateGovernanceCore')) failures.push('orquestrador único ausente');
if (!route.includes('finalizeGovernanceCoreResponse')) failures.push('finalização única ausente');
if (route.includes('finalizeGovernanceResponse(')) failures.push('finalização legada ainda ativa');
if (route.includes('orchestrateGovernanceRecovery(')) failures.push('recovery legado ainda ativo');
if (route.includes('buildGovernanceKnowledgeContext(')) failures.push('knowledge engine legado ainda ativo');
if (client.includes('linkifyLegalReferences')) failures.push('cliente ainda reconstrói links legais');
if (client.includes('buildOfficialLegalUrl')) failures.push('cliente ainda inventa URL jurídica');
if (client.includes('linkifyInstitutionalReferences')) failures.push('cliente ainda reconstrói links institucionais');
if (!metadata.includes('governance_result')) failures.push('snapshot v15 não persistido');
if (!metadata.includes('consultation_channels')) failures.push('canais não separados no snapshot');
if (!telemetry.includes('governance-v15-clean-core')) failures.push('telemetria não identifica v15');
if (!fs.existsSync(path.join(root, 'src/lib/governance-core'))) failures.push('governance-core ausente');
if (fs.existsSync(path.join(root, 'src/lib/governance-v2'))) failures.push('diretório governance-v2 ainda existe');

if (failures.length) {
  console.error('Governança v15: REPROVADO');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('OK: rota usa somente governance-core');
console.log('OK: caminhos legados removidos da rota ativa');
console.log('OK: uma única finalização');
console.log('OK: cliente não cria links jurídicos ou institucionais');
console.log('OK: snapshot canônico v15 persistido');
console.log('OK: Base legal, evidências e canais permanecem separados');
console.log('OK: telemetria versionada como governance-v15-clean-core');
console.log('Governança v15: validação arquitetural concluída.');
