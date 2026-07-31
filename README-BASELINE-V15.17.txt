PUBL.IA GOVERNANÇA — BASELINE V15.17

Objetivo
- Persistir a mensagem do usuário e a chave idempotente antes de qualquer pesquisa oficial ou chamada externa.
- Garantir que, em requisições concorrentes com o mesmo client_request_id, apenas a vencedora execute trabalho externo.
- Reavaliar conflitos de unicidade para recuperar uma resposta já concluída ou informar corretamente que o processamento continua.

Pipeline
- governance-v15.17-idempotency-before-external-work

Validação
- npm run validate:baseline
- npm run typecheck
