-- Publ.IA Governança v15.19
-- Idempotência também para mensagens do assistente.
--
-- A mensagem de usuário já possui unicidade por client_request_id. Este índice
-- impede que duas tentativas concorrentes persistam duas respostas do assistente
-- para a mesma requisição, inclusive após recuperação de lease expirado.

begin;

-- Preserva a primeira resposta e remove apenas a chave idempotente das cópias
-- históricas, caso existam. O conteúdo das mensagens não é apagado.
with ranked_duplicates as (
  select
    id,
    row_number() over (
      partition by organization_id, conversation_id, metadata ->> 'client_request_id'
      order by created_at asc, id asc
    ) as duplicate_position
  from public.governance_messages
  where role = 'assistant'
    and coalesce(metadata ->> 'client_request_id', '') <> ''
)
update public.governance_messages gm
set metadata = gm.metadata - 'client_request_id'
from ranked_duplicates rd
where gm.id = rd.id
  and rd.duplicate_position > 1;

create unique index if not exists uq_governance_messages_assistant_client_request
  on public.governance_messages (
    organization_id,
    conversation_id,
    (metadata ->> 'client_request_id')
  )
  where role = 'assistant'
    and coalesce(metadata ->> 'client_request_id', '') <> '';

commit;
