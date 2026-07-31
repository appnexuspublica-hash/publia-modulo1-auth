begin;

-- Lote 3B: mantém a API pública estável, mas remove SECURITY DEFINER
-- das funções expostas pelo schema public. As implementações privilegiadas
-- ficam em schema não exposto pelo PostgREST.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function private.current_organization_technical_role(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select om.technical_role
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  order by om.created_at asc
  limit 1;
$$;

create or replace function private.has_organization_role_at_least(
  p_organization_id uuid,
  p_minimum_role text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select public.organization_role_rank(
    private.current_organization_technical_role(p_organization_id)
  ) >= public.organization_role_rank(p_minimum_role);
$$;

create or replace function private.is_active_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function private.can_manage_organization_conversations(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select coalesce(
    private.current_organization_technical_role(p_organization_id)
      in ('owner', 'admin', 'manager'),
    false
  );
$$;

create or replace function private.create_governance_conversation(
  p_organization_id uuid,
  p_title text default 'Nova conversa',
  p_category text default null,
  p_response_mode text default 'objective',
  p_visibility text default 'private'
)
returns public.governance_conversations
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_conversation public.governance_conversations;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not private.is_active_organization_member(p_organization_id) then
    raise exception 'Usuário não é membro ativo desta organização.';
  end if;

  if p_visibility not in ('private', 'organization') then
    raise exception 'Visibilidade inválida.';
  end if;

  insert into public.governance_conversations (
    organization_id, user_id, title, category, response_mode, visibility
  ) values (
    p_organization_id,
    auth.uid(),
    coalesce(nullif(pg_catalog.btrim(p_title), ''), 'Nova conversa'),
    nullif(pg_catalog.btrim(p_category), ''),
    coalesce(nullif(pg_catalog.btrim(p_response_mode), ''), 'objective'),
    p_visibility
  ) returning * into v_conversation;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
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

create or replace function private.create_governance_organization(
  p_name text,
  p_cnpj text,
  p_slug text,
  p_legal_name text default null,
  p_primary_color text default '#0f766e'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário autenticado obrigatório no contexto administrativo.';
  end if;

  insert into public.organizations (
    name, legal_name, cnpj, slug, primary_color, created_by
  ) values (
    p_name,
    p_legal_name,
    p_cnpj,
    p_slug,
    coalesce(p_primary_color, '#0f766e'),
    auth.uid()
  ) returning id into v_organization_id;

  insert into public.organization_members (
    organization_id, user_id, functional_role, technical_role,
    status, invited_by, joined_at
  ) values (
    v_organization_id,
    auth.uid(),
    'administrador',
    'owner',
    'active',
    auth.uid(),
    pg_catalog.now()
  );

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_organization_id,
    auth.uid(),
    'organization.created',
    'organization',
    v_organization_id,
    jsonb_build_object('source', 'create_governance_organization')
  );

  return v_organization_id;
end;
$$;

revoke all on function private.is_organization_member(uuid) from public, anon;
revoke all on function private.current_organization_technical_role(uuid) from public, anon;
revoke all on function private.has_organization_role_at_least(uuid, text) from public, anon;
revoke all on function private.is_active_organization_member(uuid) from public, anon;
revoke all on function private.can_manage_organization_conversations(uuid) from public, anon;
revoke all on function private.create_governance_conversation(uuid, text, text, text, text) from public, anon;
revoke all on function private.create_governance_organization(text, text, text, text, text) from public, anon, authenticated;

grant execute on function private.is_organization_member(uuid) to authenticated, service_role;
grant execute on function private.current_organization_technical_role(uuid) to authenticated, service_role;
grant execute on function private.has_organization_role_at_least(uuid, text) to authenticated, service_role;
grant execute on function private.is_active_organization_member(uuid) to authenticated, service_role;
grant execute on function private.can_manage_organization_conversations(uuid) to authenticated, service_role;
grant execute on function private.create_governance_conversation(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function private.create_governance_organization(text, text, text, text, text) to service_role;

-- Wrappers públicos SECURITY INVOKER preservam as assinaturas usadas por RLS e código.
create or replace function public.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$ select private.is_organization_member(p_organization_id); $$;

create or replace function public.current_organization_technical_role(p_organization_id uuid)
returns text
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$ select private.current_organization_technical_role(p_organization_id); $$;

create or replace function public.has_organization_role_at_least(
  p_organization_id uuid,
  p_minimum_role text
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$ select private.has_organization_role_at_least(p_organization_id, p_minimum_role); $$;

create or replace function public.is_active_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$ select private.is_active_organization_member(p_organization_id); $$;

create or replace function public.can_manage_organization_conversations(p_organization_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$ select private.can_manage_organization_conversations(p_organization_id); $$;

create or replace function public.create_governance_conversation(
  p_organization_id uuid,
  p_title text default 'Nova conversa',
  p_category text default null,
  p_response_mode text default 'objective',
  p_visibility text default 'private'
)
returns public.governance_conversations
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.create_governance_conversation(
    p_organization_id, p_title, p_category, p_response_mode, p_visibility
  );
$$;

create or replace function public.create_governance_organization(
  p_name text,
  p_cnpj text,
  p_slug text,
  p_legal_name text default null,
  p_primary_color text default '#0f766e'
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.create_governance_organization(
    p_name, p_cnpj, p_slug, p_legal_name, p_primary_color
  );
$$;

revoke all on function public.is_organization_member(uuid) from public, anon;
revoke all on function public.current_organization_technical_role(uuid) from public, anon;
revoke all on function public.has_organization_role_at_least(uuid, text) from public, anon;
revoke all on function public.is_active_organization_member(uuid) from public, anon;
revoke all on function public.can_manage_organization_conversations(uuid) from public, anon;
revoke all on function public.create_governance_conversation(uuid, text, text, text, text) from public, anon;
revoke all on function public.create_governance_organization(text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.is_organization_member(uuid) to authenticated, service_role;
grant execute on function public.current_organization_technical_role(uuid) to authenticated, service_role;
grant execute on function public.has_organization_role_at_least(uuid, text) to authenticated, service_role;
grant execute on function public.is_active_organization_member(uuid) to authenticated, service_role;
grant execute on function public.can_manage_organization_conversations(uuid) to authenticated, service_role;
grant execute on function public.create_governance_conversation(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.create_governance_organization(text, text, text, text, text) to service_role;

commit;
