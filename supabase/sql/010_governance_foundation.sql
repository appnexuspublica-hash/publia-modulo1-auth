-- 010_governance_foundation.sql
-- Publ.IA Governança — Fundação institucional
--
-- Objetivo:
-- Criar a base multi-organização do produto Governança sem alterar nem quebrar
-- as tabelas atuais dos planos Essencial/Estratégico.
--
-- Este arquivo cria apenas estruturas novas:
-- - organizations
-- - organization_members
-- - organization_invitations
-- - official_sources
-- - institutional_documents
-- - organization_audit_logs
--
-- Importante:
-- - conversations, messages, pdf_files, user_access e usage_events NÃO são alteradas aqui.
-- - O centro do Governança passa a ser organization_id.
-- - O usuário continua existindo via auth.users, mas atua como membro de uma organização.

create extension if not exists pgcrypto;

-- =========================================================
-- 1) Função compartilhada de updated_at
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
-- 2) Organizações
-- =========================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  legal_name text null,
  cnpj text not null unique,
  slug text not null unique,

  product_tier text not null default 'governance'
    check (product_tier in ('governance')),

  status text not null default 'implementation'
    check (status in ('implementation', 'active', 'inactive', 'suspended', 'archived')),

  primary_color text not null default '#0f766e',
  logo_url text null,

  contract_starts_at timestamptz null,
  contract_ends_at timestamptz null,
  seats_limit integer null check (seats_limit is null or seats_limit > 0),

  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organizations_status
  on public.organizations(status);

create index if not exists idx_organizations_created_by
  on public.organizations(created_by);

drop trigger if exists trg_organizations_set_updated_at on public.organizations;
create trigger trg_organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

alter table public.organizations enable row level security;

-- =========================================================
-- 3) Membros da organização
-- =========================================================
-- Separação importante:
-- functional_role = papel/cargo institucional
-- technical_role = permissão técnica dentro do sistema

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  functional_role text not null default 'servidor'
    check (
      functional_role in (
        'administrador',
        'gestor',
        'controle_interno',
        'juridico',
        'contabilidade',
        'licitacoes',
        'servidor',
        'consultor',
        'outro'
      )
    ),

  technical_role text not null default 'member'
    check (
      technical_role in (
        'owner',
        'admin',
        'manager',
        'member',
        'viewer'
      )
    ),

  status text not null default 'active'
    check (status in ('active', 'invited', 'suspended', 'removed')),

  invited_by uuid null references auth.users(id) on delete set null,
  joined_at timestamptz null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, user_id)
);

create index if not exists idx_organization_members_org
  on public.organization_members(organization_id);

create index if not exists idx_organization_members_user
  on public.organization_members(user_id);

create index if not exists idx_organization_members_org_status
  on public.organization_members(organization_id, status);

drop trigger if exists trg_organization_members_set_updated_at on public.organization_members;
create trigger trg_organization_members_set_updated_at
before update on public.organization_members
for each row
execute function public.set_updated_at();

alter table public.organization_members enable row level security;

-- =========================================================
-- 4) Funções auxiliares de permissão
-- =========================================================
-- Usadas nas policies RLS.
-- São SECURITY DEFINER para evitar recursão de RLS ao consultar organization_members.

create or replace function public.is_organization_member(p_organization_id uuid)
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

create or replace function public.current_organization_technical_role(p_organization_id uuid)
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
  limit 1;
$$;

create or replace function public.organization_role_rank(p_role text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_role
    when 'owner' then 50
    when 'admin' then 40
    when 'manager' then 30
    when 'member' then 20
    when 'viewer' then 10
    else 0
  end;
$$;

create or replace function public.has_organization_role_at_least(
  p_organization_id uuid,
  p_minimum_role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.organization_role_rank(
    public.current_organization_technical_role(p_organization_id)
  ) >= public.organization_role_rank(p_minimum_role);
$$;

grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.current_organization_technical_role(uuid) to authenticated;
grant execute on function public.organization_role_rank(text) to authenticated;
grant execute on function public.has_organization_role_at_least(uuid, text) to authenticated;

-- =========================================================
-- 5) Policies: organizations
-- =========================================================

drop policy if exists "organizations_select_members" on public.organizations;
create policy "organizations_select_members"
on public.organizations
for select
to authenticated
using (
  public.is_organization_member(id)
);

drop policy if exists "organizations_insert_authenticated" on public.organizations;
create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (
  created_by = auth.uid()
);

drop policy if exists "organizations_update_admins" on public.organizations;
create policy "organizations_update_admins"
on public.organizations
for update
to authenticated
using (
  public.has_organization_role_at_least(id, 'admin')
)
with check (
  public.has_organization_role_at_least(id, 'admin')
);

-- Sem policy de delete.
-- Organizações devem ser arquivadas/suspensas, não apagadas.

-- =========================================================
-- 6) Policies: organization_members
-- =========================================================

drop policy if exists "organization_members_select_same_org" on public.organization_members;
create policy "organization_members_select_same_org"
on public.organization_members
for select
to authenticated
using (
  public.is_organization_member(organization_id)
);

drop policy if exists "organization_members_insert_admins" on public.organization_members;
create policy "organization_members_insert_admins"
on public.organization_members
for insert
to authenticated
with check (
  public.has_organization_role_at_least(organization_id, 'admin')
);

drop policy if exists "organization_members_update_admins" on public.organization_members;
create policy "organization_members_update_admins"
on public.organization_members
for update
to authenticated
using (
  public.has_organization_role_at_least(organization_id, 'admin')
)
with check (
  public.has_organization_role_at_least(organization_id, 'admin')
);

-- Sem policy de delete.
-- Para remover membro, use status = 'removed'.

-- =========================================================
-- 7) Convites institucionais
-- =========================================================

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  token text not null unique,

  functional_role text not null default 'servidor'
    check (
      functional_role in (
        'administrador',
        'gestor',
        'controle_interno',
        'juridico',
        'contabilidade',
        'licitacoes',
        'servidor',
        'consultor',
        'outro'
      )
    ),

  technical_role text not null default 'member'
    check (
      technical_role in (
        'owner',
        'admin',
        'manager',
        'member',
        'viewer'
      )
    ),

  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'cancelled')),

  invited_by uuid null references auth.users(id) on delete set null,
  accepted_by uuid null references auth.users(id) on delete set null,

  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, email)
);

create index if not exists idx_organization_invitations_org
  on public.organization_invitations(organization_id);

create index if not exists idx_organization_invitations_email
  on public.organization_invitations(email);

create index if not exists idx_organization_invitations_token
  on public.organization_invitations(token);

drop trigger if exists trg_organization_invitations_set_updated_at on public.organization_invitations;
create trigger trg_organization_invitations_set_updated_at
before update on public.organization_invitations
for each row
execute function public.set_updated_at();

alter table public.organization_invitations enable row level security;

drop policy if exists "organization_invitations_select_admins" on public.organization_invitations;
create policy "organization_invitations_select_admins"
on public.organization_invitations
for select
to authenticated
using (
  public.has_organization_role_at_least(organization_id, 'admin')
);

drop policy if exists "organization_invitations_insert_admins" on public.organization_invitations;
create policy "organization_invitations_insert_admins"
on public.organization_invitations
for insert
to authenticated
with check (
  public.has_organization_role_at_least(organization_id, 'admin')
  and invited_by = auth.uid()
);

drop policy if exists "organization_invitations_update_admins" on public.organization_invitations;
create policy "organization_invitations_update_admins"
on public.organization_invitations
for update
to authenticated
using (
  public.has_organization_role_at_least(organization_id, 'admin')
)
with check (
  public.has_organization_role_at_least(organization_id, 'admin')
);

-- =========================================================
-- 8) Fontes oficiais
-- =========================================================

create table if not exists public.official_sources (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,

  name text not null,
  source_type text not null
    check (
      source_type in (
        'municipal_website',
        'official_gazette',
        'transparency_portal',
        'institutional_repository',
        'other'
      )
    ),

  url text not null,

  status text not null default 'pending_review'
    check (status in ('pending_review', 'active', 'inactive', 'archived')),

  notes text null,

  created_by uuid null references auth.users(id) on delete set null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_official_sources_org
  on public.official_sources(organization_id);

create index if not exists idx_official_sources_status
  on public.official_sources(organization_id, status);

drop trigger if exists trg_official_sources_set_updated_at on public.official_sources;
create trigger trg_official_sources_set_updated_at
before update on public.official_sources
for each row
execute function public.set_updated_at();

alter table public.official_sources enable row level security;

drop policy if exists "official_sources_select_members" on public.official_sources;
create policy "official_sources_select_members"
on public.official_sources
for select
to authenticated
using (
  public.is_organization_member(organization_id)
);

drop policy if exists "official_sources_insert_managers" on public.official_sources;
create policy "official_sources_insert_managers"
on public.official_sources
for insert
to authenticated
with check (
  public.has_organization_role_at_least(organization_id, 'manager')
  and created_by = auth.uid()
);

drop policy if exists "official_sources_update_managers" on public.official_sources;
create policy "official_sources_update_managers"
on public.official_sources
for update
to authenticated
using (
  public.has_organization_role_at_least(organization_id, 'manager')
)
with check (
  public.has_organization_role_at_least(organization_id, 'manager')
);

-- =========================================================
-- 9) Documentos institucionais
-- =========================================================
-- Esta tabela é separada de pdf_files.
-- pdf_files continua sendo usada para anexos de conversa.
-- institutional_documents representa a base oficial/curada do órgão.

create table if not exists public.institutional_documents (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,
  official_source_id uuid null references public.official_sources(id) on delete set null,

  uploaded_by uuid null references auth.users(id) on delete set null,
  reviewed_by uuid null references auth.users(id) on delete set null,

  title text not null,

  document_type text not null
    check (
      document_type in (
        'lei',
        'decreto',
        'portaria',
        'instrucao_normativa',
        'manual',
        'parecer_modelo',
        'regulamento',
        'contrato',
        'edital',
        'ata',
        'outro'
      )
    ),

  category text null,

  source_name text null,
  source_url text null,

  valid_from date null,
  valid_until date null,

  storage_bucket text not null default 'institutional-documents',
  storage_path text not null,

  file_name text null,
  file_size bigint null,
  mime_type text null,

  extracted_text text null,

  indexing_status text not null default 'not_indexed'
    check (
      indexing_status in (
        'not_indexed',
        'pending',
        'processing',
        'indexed',
        'failed'
      )
    ),

  review_status text not null default 'draft'
    check (
      review_status in (
        'draft',
        'pending_review',
        'approved',
        'rejected',
        'archived'
      )
    ),

  metadata jsonb not null default '{}'::jsonb,

  reviewed_at timestamptz null,
  indexed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_institutional_documents_org
  on public.institutional_documents(organization_id);

create index if not exists idx_institutional_documents_org_review
  on public.institutional_documents(organization_id, review_status);

create index if not exists idx_institutional_documents_org_indexing
  on public.institutional_documents(organization_id, indexing_status);

create index if not exists idx_institutional_documents_type
  on public.institutional_documents(organization_id, document_type);

create index if not exists idx_institutional_documents_source
  on public.institutional_documents(official_source_id);

drop trigger if exists trg_institutional_documents_set_updated_at on public.institutional_documents;
create trigger trg_institutional_documents_set_updated_at
before update on public.institutional_documents
for each row
execute function public.set_updated_at();

alter table public.institutional_documents enable row level security;

drop policy if exists "institutional_documents_select_members" on public.institutional_documents;
create policy "institutional_documents_select_members"
on public.institutional_documents
for select
to authenticated
using (
  public.is_organization_member(organization_id)
);

drop policy if exists "institutional_documents_insert_managers" on public.institutional_documents;
create policy "institutional_documents_insert_managers"
on public.institutional_documents
for insert
to authenticated
with check (
  public.has_organization_role_at_least(organization_id, 'manager')
  and uploaded_by = auth.uid()
);

drop policy if exists "institutional_documents_update_managers" on public.institutional_documents;
create policy "institutional_documents_update_managers"
on public.institutional_documents
for update
to authenticated
using (
  public.has_organization_role_at_least(organization_id, 'manager')
)
with check (
  public.has_organization_role_at_least(organization_id, 'manager')
);

-- Sem policy de delete.
-- Para remover da base, use review_status = 'archived'.

-- =========================================================
-- 10) Auditoria institucional básica
-- =========================================================

create table if not exists public.organization_audit_logs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,

  action text not null,
  entity_type text not null,
  entity_id uuid null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_organization_audit_logs_org_created
  on public.organization_audit_logs(organization_id, created_at desc);

create index if not exists idx_organization_audit_logs_actor
  on public.organization_audit_logs(actor_user_id, created_at desc);

create index if not exists idx_organization_audit_logs_entity
  on public.organization_audit_logs(entity_type, entity_id);

alter table public.organization_audit_logs enable row level security;

drop policy if exists "organization_audit_logs_select_admins" on public.organization_audit_logs;
create policy "organization_audit_logs_select_admins"
on public.organization_audit_logs
for select
to authenticated
using (
  public.has_organization_role_at_least(organization_id, 'admin')
);

drop policy if exists "organization_audit_logs_insert_members" on public.organization_audit_logs;
create policy "organization_audit_logs_insert_members"
on public.organization_audit_logs
for insert
to authenticated
with check (
  public.is_organization_member(organization_id)
  and actor_user_id = auth.uid()
);

-- Sem update e sem delete.
-- Log de auditoria deve ser append-only.

-- =========================================================
-- 11) View de organizações do usuário atual
-- =========================================================

create or replace view public.my_organizations as
select
  o.id,
  o.name,
  o.legal_name,
  o.cnpj,
  o.slug,
  o.product_tier,
  o.status,
  o.primary_color,
  o.logo_url,
  o.contract_starts_at,
  o.contract_ends_at,
  o.seats_limit,
  om.functional_role,
  om.technical_role,
  om.status as member_status,
  om.joined_at,
  o.created_at,
  o.updated_at
from public.organizations o
join public.organization_members om
  on om.organization_id = o.id
where om.user_id = auth.uid()
  and om.status = 'active';

grant select on public.my_organizations to authenticated;

-- =========================================================
-- 12) Função opcional para criar organização com owner inicial
-- =========================================================
-- Esta função ajuda no bootstrap do Governança:
-- cria a organização e já vincula o usuário atual como owner.
-- Use apenas em rota administrativa/controlada no backend.

create or replace function public.create_governance_organization(
  p_name text,
  p_cnpj text,
  p_slug text,
  p_legal_name text default null,
  p_primary_color text default '#0f766e'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  insert into public.organizations (
    name,
    legal_name,
    cnpj,
    slug,
    primary_color,
    created_by
  )
  values (
    p_name,
    p_legal_name,
    p_cnpj,
    p_slug,
    coalesce(p_primary_color, '#0f766e'),
    auth.uid()
  )
  returning id into v_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    functional_role,
    technical_role,
    status,
    invited_by,
    joined_at
  )
  values (
    v_organization_id,
    auth.uid(),
    'administrador',
    'owner',
    'active',
    auth.uid(),
    now()
  );

  insert into public.organization_audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
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

grant execute on function public.create_governance_organization(text, text, text, text, text) to authenticated;

-- =========================================================
-- Fim do Módulo G1 — Fundação institucional
-- =========================================================
