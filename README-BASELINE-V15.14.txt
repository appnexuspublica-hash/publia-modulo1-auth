PUBLIA — BASELINE GOVERNANÇA V15.14

Objetivo
Impedir que um governance_result parcial ou corrompido bloqueie a leitura das
referências legadas de conversas antigas.

Correção
O parser do snapshot agora valida o contrato completo: versão, três coleções e
status de evidência. Um snapshot completo e vazio permanece válido; um objeto
parcial retorna null e permite ao cliente usar references/sources legados.

Arquivos alterados
- src/lib/governance/chat/governance-result.ts
- src/lib/governance-core/version.ts
- scripts/validate-governance-baseline-v15.14.ts
- docs/governance-baseline-v15.14.json
- README-BASELINE-V15.14.txt
- package.json

Validação
npm run validate:baseline
npm run typecheck
