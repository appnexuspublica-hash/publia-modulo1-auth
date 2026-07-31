-- Publ.IA Governança v12.6
-- Idempotência transacional das mensagens enviadas pelo usuário.
--
-- A aplicação grava client_request_id em metadata. Esta migration materializa
-- esse valor em uma coluna gerada e cria uma unicidade parcial para mensagens
-- de usuário. Assim, duas instâncias concorrentes não conseguem persistir a
-- mesma requisição na mesma conversa.

begin;

alter table public.governance_messages
  add column if not exists client_request_id uuid
  generated always as (
    case
      when role = 'user'
       and metadata ? 'client_request_id'
       and (metadata ->> 'client_request_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (metadata ->> 'client_request_id')::uuid
      else null
    end
  ) stored;

comment on column public.governance_messages.client_request_id is
  'UUID idempotente materializado de metadata.client_request_id para mensagens de usuário.';

-- Preserva a primeira mensagem e remove somente a chave idempotente das cópias
-- históricas, caso existam. O conteúdo das mensagens não é apagado.
with ranked_duplicates as (
  select
    id,
    row_number() over (
      partition by organization_id, conversation_id, client_request_id
      order by created_at asc, id asc
    ) as duplicate_position
  from public.governance_messages
  where role = 'user'
    and client_request_id is not null
)
update public.governance_messages gm
set metadata = gm.metadata - 'client_request_id'
from ranked_duplicates rd
where gm.id = rd.id
  and rd.duplicate_position > 1;

create unique index if not exists uq_governance_messages_user_client_request
  on public.governance_messages (
    organization_id,
    conversation_id,
    client_request_id
  )
  where role = 'user'
    and client_request_id is not null;

create index if not exists idx_governance_messages_client_request
  on public.governance_messages (client_request_id)
  where client_request_id is not null;

commit;
