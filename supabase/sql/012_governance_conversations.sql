-- =========================================================
-- 012_governance_conversations.sql
-- Publ.IA Governança - Conversas institucionais
-- =========================================================
--
-- Objetivo:
-- Criar uma estrutura própria de conversas e mensagens para
-- o Publ.IA Governança, centrada em organization_id.
--
-- Importante:
-- - Não altera conversations/messages atuais.
-- - Não altera o chat dos planos Essencial/Estratégico.
-- - Depende do arquivo 010_governance_foundation.sql.
-- - Usa isolamento lógico por organization_id + RLS.
--
-- =========================================================

-- =========================================================
-- Extensões necessárias
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- Função auxiliar de updated_at
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- Tabela: governance_conversations
-- =========================================================
--
-- Conversas institucionais do Governança.
--
-- Diferença para a tabela conversations atual:
-- - Aqui organization_id é obrigatório.
-- - user_id indica o usuário que criou/iniciou a conversa.
-- - A conversa pertence ao órgão, não apenas ao usuário.
--
-- =========================================================

create table if not exists public.governance_conversations (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null default 'Nova conversa',

  -- Categoria institucional da conversa.
  -- Ex.: jurídico, licitações, controle interno, contabilidade etc.
  category text null,

  -- Modo de resposta preferido.
  -- Ex.: resumo, checklist, parecer técnico, análise de risco etc.
  response_mode text not null default 'objective',

  -- Visibilidade institucional.
  -- private = visível ao autor e administradores/gestores.
  -- organization = visível para membros autorizados da organização.
  visibility text not null default 'private'
    check (visibility in ('private', 'organization')),

  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),

  is_pinned boolean not null default false,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

comment on table public.governance_conversations is
  'Conversas institucionais do Publ.IA Governança, isoladas por organization_id.';

comment on column public.governance_conversations.organization_id is
  'Organização/órgão dono da conversa institucional.';

comment on column public.governance_conversations.user_id is
  'Usuário que criou a conversa institucional.';

comment on column public.governance_conversations.visibility is
  'Define se a conversa é privada do autor ou compartilhada no âmbito da organização.';

-- =========================================================
-- Índices: governance_conversations
-- =========================================================

create index if not exists idx_governance_conversations_org
  on public.governance_conversations (organization_id);

create index if not exists idx_governance_conversations_user
  on public.governance_conversations (user_id);

create index if not exists idx_governance_conversations_org_updated
  on public.governance_conversations (organization_id, updated_at desc);

create index if not exists idx_governance_conversations_status
  on public.governance_conversations (status);

create index if not exists idx_governance_conversations_deleted_at
  on public.governance_conversations (deleted_at);

-- =========================================================
-- Trigger updated_at: governance_conversations
-- =========================================================

drop trigger if exists trg_governance_conversations_updated_at
  on public.governance_conversations;

create trigger trg_governance_conversations_updated_at
before update on public.governance_conversations
for each row
execute function public.set_updated_at();

-- =========================================================
-- Tabela: governance_messages
-- =========================================================
--
-- Mensagens das conversas institucionais.
--
-- organization_id é repetido aqui de forma intencional:
-- - facilita RLS
-- - facilita auditoria
-- - facilita consultas por órgão
-- - evita depender sempre de join com conversations
--
-- =========================================================

create table if not exists public.governance_messages (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.governance_conversations(id) on delete cascade,

  -- Para mensagens de usuário, preencher com auth.users.id.
  -- Para mensagens de IA/sistema, pode ficar null ou receber o autor técnico da operação.
  user_id uuid null references auth.users(id) on delete set null,

  role text not null
    check (role in ('user', 'assistant', 'system')),

  content text not null,

  -- Espaço para guardar dados futuros:
  -- modo de resposta, fontes usadas, documentos consultados, tokens etc.
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

comment on table public.governance_messages is
  'Mensagens das conversas institucionais do Publ.IA Governança.';

comment on column public.governance_messages.organization_id is
  'Organização/órgão dono da mensagem institucional.';

comment on column public.governance_messages.conversation_id is
  'Conversa institucional à qual a mensagem pertence.';

comment on column public.governance_messages.role is
  'Papel da mensagem: user, assistant ou system.';

-- =========================================================
-- Índices: governance_messages
-- =========================================================

create index if not exists idx_governance_messages_org
  on public.governance_messages (organization_id);

create index if not exists idx_governance_messages_conversation
  on public.governance_messages (conversation_id, created_at asc);

create index if not exists idx_governance_messages_user
  on public.governance_messages (user_id);

create index if not exists idx_governance_messages_role
  on public.governance_messages (role);

-- =========================================================
-- Funções auxiliares para RLS
-- =========================================================

create or replace function public.is_active_organization_member(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.current_organization_technical_role(
  p_organization_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select om.technical_role
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  order by om.created_at asc
  limit 1;
$$;

create or replace function public.can_manage_organization_conversations(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_organization_technical_role(p_organization_id)
      in ('owner', 'admin', 'manager'),
    false
  );
$$;

-- =========================================================
-- RLS: governance_conversations
-- =========================================================

alter table public.governance_conversations enable row level security;

drop policy if exists "governance_conversations_select_active_members"
  on public.governance_conversations;

create policy "governance_conversations_select_active_members"
on public.governance_conversations
for select
to authenticated
using (
  deleted_at is null
  and status <> 'deleted'
  and public.is_active_organization_member(organization_id)
  and (
    visibility = 'organization'
    or user_id = auth.uid()
    or public.can_manage_organization_conversations(organization_id)
  )
);

drop policy if exists "governance_conversations_insert_active_members"
  on public.governance_conversations;

create policy "governance_conversations_insert_active_members"
on public.governance_conversations
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_organization_member(organization_id)
);

drop policy if exists "governance_conversations_update_author_or_managers"
  on public.governance_conversations;

create policy "governance_conversations_update_author_or_managers"
on public.governance_conversations
for update
to authenticated
using (
  public.is_active_organization_member(organization_id)
  and (
    user_id = auth.uid()
    or public.can_manage_organization_conversations(organization_id)
  )
)
with check (
  public.is_active_organization_member(organization_id)
  and (
    user_id = auth.uid()
    or public.can_manage_organization_conversations(organization_id)
  )
);

drop policy if exists "governance_conversations_delete_managers"
  on public.governance_conversations;

create policy "governance_conversations_delete_managers"
on public.governance_conversations
for delete
to authenticated
using (
  public.is_active_organization_member(organization_id)
  and public.can_manage_organization_conversations(organization_id)
);

-- =========================================================
-- RLS: governance_messages
-- =========================================================

alter table public.governance_messages enable row level security;

drop policy if exists "governance_messages_select_active_members"
  on public.governance_messages;

create policy "governance_messages_select_active_members"
on public.governance_messages
for select
to authenticated
using (
  public.is_active_organization_member(organization_id)
  and exists (
    select 1
    from public.governance_conversations gc
    where gc.id = governance_messages.conversation_id
      and gc.organization_id = governance_messages.organization_id
      and gc.deleted_at is null
      and gc.status <> 'deleted'
      and (
        gc.visibility = 'organization'
        or gc.user_id = auth.uid()
        or public.can_manage_organization_conversations(gc.organization_id)
      )
  )
);

drop policy if exists "governance_messages_insert_active_members"
  on public.governance_messages;

create policy "governance_messages_insert_active_members"
on public.governance_messages
for insert
to authenticated
with check (
  public.is_active_organization_member(organization_id)
  and exists (
    select 1
    from public.governance_conversations gc
    where gc.id = conversation_id
      and gc.organization_id = organization_id
      and gc.deleted_at is null
      and gc.status <> 'deleted'
      and (
        gc.user_id = auth.uid()
        or public.can_manage_organization_conversations(gc.organization_id)
      )
  )
  and (
    role in ('assistant', 'system')
    or user_id = auth.uid()
  )
);

drop policy if exists "governance_messages_update_managers"
  on public.governance_messages;

create policy "governance_messages_update_managers"
on public.governance_messages
for update
to authenticated
using (
  public.is_active_organization_member(organization_id)
  and public.can_manage_organization_conversations(organization_id)
)
with check (
  public.is_active_organization_member(organization_id)
  and public.can_manage_organization_conversations(organization_id)
);

drop policy if exists "governance_messages_delete_managers"
  on public.governance_messages;

create policy "governance_messages_delete_managers"
on public.governance_messages
for delete
to authenticated
using (
  public.is_active_organization_member(organization_id)
  and public.can_manage_organization_conversations(organization_id)
);

-- =========================================================
-- Função RPC: criar conversa institucional
-- =========================================================
--
-- Esta função facilita a criação da conversa pelo frontend.
-- Ela garante:
-- - usuário autenticado
-- - usuário membro ativo da organização
-- - user_id sempre igual ao auth.uid()
--
-- =========================================================

create or replace function public.create_governance_conversation(
  p_organization_id uuid,
  p_title text default 'Nova conversa',
  p_category text default null,
  p_response_mode text default 'objective',
  p_visibility text default 'private'
)
returns public.governance_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.governance_conversations;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_active_organization_member(p_organization_id) then
    raise exception 'Usuário não é membro ativo desta organização.';
  end if;

  if p_visibility not in ('private', 'organization') then
    raise exception 'Visibilidade inválida.';
  end if;

  insert into public.governance_conversations (
    organization_id,
    user_id,
    title,
    category,
    response_mode,
    visibility
  )
  values (
    p_organization_id,
    auth.uid(),
    coalesce(nullif(trim(p_title), ''), 'Nova conversa'),
    nullif(trim(p_category), ''),
    coalesce(nullif(trim(p_response_mode), ''), 'objective'),
    p_visibility
  )
  returning * into v_conversation;

  insert into public.organization_audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_organization_id,
    auth.uid(),
    'governance_conversation.created',
    'governance_conversation',
    v_conversation.id,
    jsonb_build_object(
      'title', v_conversation.title,
      'visibility', v_conversation.visibility,
      'response_mode', v_conversation.response_mode
    )
  );

  return v_conversation;
end;
$$;

grant execute on function public.create_governance_conversation(
  uuid,
  text,
  text,
  text,
  text
) to authenticated;

-- =========================================================
-- Fim
-- =========================================================