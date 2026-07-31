PUBLIA — BASELINE GOVERNANÇA V15.15

Objetivo
Impedir que a rota salve a mensagem do usuário ou inicie consultas externas quando
a persistência confiável das respostas do assistente não estiver configurada.

Correção
A disponibilidade do cliente Supabase com service role agora é validada logo após
a autorização e a checagem de idempotência. Em caso de ausência, a rota retorna
503 antes de gravar a mensagem do usuário, evitando mensagens órfãs determinísticas.

Arquivos alterados
- src/app/api/governance/chat/route.ts
- src/lib/governance-core/version.ts
- scripts/validate-governance-baseline-v15.15.ts
- docs/governance-baseline-v15.15.json
- README-BASELINE-V15.15.txt
- package.json

Validação
npm run validate:baseline
npm run typecheck
