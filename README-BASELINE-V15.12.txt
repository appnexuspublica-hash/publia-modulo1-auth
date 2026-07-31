PUBLIA — BASELINE GOVERNANÇA V15.12

Objetivo
Consolidar o mesmo contrato de referências para mensagens persistidas e respostas transitórias.

Correção
A resposta transitória agora recebe metadata.governance_result, construída pelo mesmo
buildGovernanceResultSnapshot usado nas mensagens salvas. Isso evita que uma resposta
gerada durante a remoção da conversa apareça sem Base legal, Fontes consultadas ou
Canais oficiais no cliente.

Arquivos alterados
- src/lib/governance/chat/infrastructure.ts
- src/lib/governance/chat/transient-response.ts
- src/lib/governance-core/version.ts
- scripts/validate-governance-baseline-v15.12.ts
- docs/governance-baseline-v15.12.json
- package.json

Validação
npm run validate:baseline
npm run typecheck
