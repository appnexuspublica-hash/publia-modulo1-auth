PUBLIA — BASELINE GOVERNANÇA V15.13

Objetivo
Eliminar as últimas cópias paralelas de fontes e referências no envelope HTTP/SSE.

Correção
As respostas persistidas e transitórias agora retornam referências somente dentro de
assistantMessage.metadata.governance_result. Os campos de primeiro nível sources e
references foram removidos do payload novo. O cliente já usa a mensagem canônica e
mantém compatibilidade com metadata legada apenas ao abrir conversas antigas.

Arquivos alterados
- src/lib/governance/chat/response-payload.ts
- src/lib/governance/chat/transient-response.ts
- src/app/api/governance/chat/route.ts
- src/lib/governance-core/version.ts
- scripts/validate-governance-baseline-v15.13.ts
- docs/governance-baseline-v15.13.json
- package.json

Validação
npm run validate:baseline
npm run typecheck
