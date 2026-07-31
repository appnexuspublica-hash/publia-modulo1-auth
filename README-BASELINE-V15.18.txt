PUBL.IA GOVERNANÇA — BASELINE V15.18

Objetivo
Evitar que uma requisição permaneça eternamente no estado "em processamento"
quando o servidor, a OpenAI ou a persistência forem interrompidos antes da
mensagem do assistente ser salva.

Mudança principal
Cada mensagem nova do usuário registra um lease de processamento:
- processing_status
- processing_started_at
- processing_attempt_id
- processing_attempt_count

Se nenhuma resposta do assistente existir após o prazo do lease, a mesma
requisição pode ser recuperada. A recuperação troca atomicamente o identificador
da tentativa antes de qualquer pesquisa oficial, recuperação de evidências ou
chamada à OpenAI.

Configuração
GOVERNANCE_IDEMPOTENCY_LEASE_SECONDS
Padrão: 300 segundos
Mínimo: 30 segundos
Máximo: 1800 segundos

Segurança
A chave idempotente expirada não pode ser reutilizada com conteúdo diferente.
Em uma corrida de recuperação, somente uma tentativa conquista o lease; as
demais recebem a resposta concluída ou o estado de processamento em andamento.
