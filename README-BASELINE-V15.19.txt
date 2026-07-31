PUBL.IA GOVERNANÇA — BASELINE V15.19

Objetivo
Garantir unicidade transacional também para mensagens do assistente.

Problema corrigido
Após a recuperação de um lease expirado, duas tentativas ainda poderiam chegar quase simultaneamente à persistência da resposta. A idempotência da mensagem do usuário não impedia duas mensagens de assistente com o mesmo client_request_id.

Solução
1. Migration cria índice único parcial para respostas do assistente por organização, conversa e client_request_id.
2. Duplicidades históricas preservam o conteúdo, mas perdem apenas a chave idempotente excedente.
3. O saver da resposta trata erro PostgreSQL 23505 e recupera a resposta já persistida.
4. Nenhuma regra de conteúdo, provider, Base legal ou interface foi alterada.

Validação
npm run validate:baseline

Migration
npx supabase db push

Rollback
supabase/rollback/202607280001_621_governance_assistant_idempotency.rollback.sql
