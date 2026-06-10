//supabase/sql/013_governance_organization_fields
-- =========================================================
-- 013_governance_organization_fields.sql
-- Publ.IA Governança — Campos completos do cadastro do órgão
-- Versão corrigida
-- =========================================================

-- =========================================================
-- 1) Campos institucionais do órgão
-- =========================================================

alter table public.organizations
  add column if not exists organization_type text;

alter table public.organizations
  add column if not exists municipality_name text;

alter table public.organizations
  add column if not exists state_uf text;

alter table public.organizations
  add column if not exists ibge_code text;

alter table public.organizations
  add column if not exists municipality_size text;

alter table public.organizations
  add column if not exists contract_reference text;

alter table public.organizations
  add column if not exists history_retention_policy text;

-- =========================================================
-- 2) Defaults seguros
-- =========================================================

alter table public.organizations
  alter column organization_type set default 'prefeitura';

alter table public.organizations
  alter column municipality_size set default 'small';

alter table public.organizations
  alter column history_retention_policy set default 'contract_duration';

update public.organizations
set
  organization_type = coalesce(organization_type, 'prefeitura'),
  municipality_size = coalesce(municipality_size, 'small'),
  history_retention_policy = coalesce(history_retention_policy, 'contract_duration')
where
  organization_type is null
  or municipality_size is null
  or history_retention_policy is null;

alter table public.organizations
  alter column organization_type set not null;

alter table public.organizations
  alter column municipality_size set not null;

alter table public.organizations
  alter column history_retention_policy set not null;

alter table public.organizations
  alter column primary_color set default '#0f3a4a';

-- =========================================================
-- 3) Constraints seguras
-- =========================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_organization_type_check'
  ) then
    alter table public.organizations
      add constraint organizations_organization_type_check
      check (
        organization_type in (
          'prefeitura',
          'camara_municipal',
          'autarquia',
          'fundacao',
          'consorcio_publico',
          'instituto_previdencia',
          'outro'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_state_uf_check'
  ) then
    alter table public.organizations
      add constraint organizations_state_uf_check
      check (
        state_uf is null
        or state_uf ~ '^[A-Z]{2}$'
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_ibge_code_check'
  ) then
    alter table public.organizations
      add constraint organizations_ibge_code_check
      check (
        ibge_code is null
        or ibge_code ~ '^[0-9]{7}$'
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_municipality_size_check'
  ) then
    alter table public.organizations
      add constraint organizations_municipality_size_check
      check (
        municipality_size in ('small', 'medium', 'large')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_history_retention_policy_check'
  ) then
    alter table public.organizations
      add constraint organizations_history_retention_policy_check
      check (
        history_retention_policy in ('contract_duration')
      );
  end if;
end $$;

-- =========================================================
-- 4) Comentários
-- =========================================================

comment on column public.organizations.organization_type is
  'Tipo do órgão: prefeitura, câmara municipal, autarquia, fundação, consórcio público, instituto/previdência ou outro.';

comment on column public.organizations.municipality_name is
  'Município ao qual o órgão está vinculado.';

comment on column public.organizations.state_uf is
  'UF do município, com duas letras. Ex.: SP, MG, RJ.';

comment on column public.organizations.ibge_code is
  'Código IBGE do município, com 7 dígitos.';

comment on column public.organizations.municipality_size is
  'Porte do município: small até 50 mil habitantes, medium de 50 mil até 200 mil, large acima de 200 mil.';

comment on column public.organizations.contract_reference is
  'Referência interna, número ou identificação do contrato Governança.';

comment on column public.organizations.history_retention_policy is
  'Política de retenção do histórico. contract_duration = manter histórico enquanto durar o contrato.';

-- =========================================================
-- 5) Índices auxiliares
-- =========================================================

create index if not exists idx_organizations_organization_type
  on public.organizations(organization_type);

create index if not exists idx_organizations_state_uf
  on public.organizations(state_uf);

create index if not exists idx_organizations_municipality_size
  on public.organizations(municipality_size);

create index if not exists idx_organizations_ibge_code
  on public.organizations(ibge_code);

create index if not exists idx_organizations_contract_dates
  on public.organizations(contract_starts_at, contract_ends_at);

-- =========================================================
-- 6) Conversas Governança: comentários e índice auxiliar
-- =========================================================

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'governance_conversations'
  ) then
    comment on column public.governance_conversations.title is
      'Título da conversa. Permite renomear conversa no Governança.';

    comment on column public.governance_conversations.is_pinned is
      'Indica se a conversa está fixada pelo usuário ou pela regra institucional.';

    comment on column public.governance_conversations.deleted_at is
      'Data de exclusão lógica da conversa. Permite excluir sem apagar fisicamente durante o contrato.';

    comment on column public.governance_conversations.status is
      'Status da conversa: active, archived ou deleted.';
  end if;
end $$;

create index if not exists idx_governance_conversations_org_pinned_updated
  on public.governance_conversations(organization_id, is_pinned desc, updated_at desc);

-- =========================================================
-- 7) Recria a view my_organizations corretamente
-- =========================================================
-- Importante:
-- Usamos DROP VIEW + CREATE VIEW, e não CREATE OR REPLACE VIEW,
-- porque o PostgreSQL não permite mudar a ordem/nome das colunas
-- existentes com CREATE OR REPLACE VIEW.
-- =========================================================

drop view if exists public.my_organizations;

create view public.my_organizations as
select
  o.id,
  o.name,
  o.legal_name,
  o.cnpj,
  o.slug,
  o.organization_type,
  o.municipality_name,
  o.state_uf,
  o.ibge_code,
  o.municipality_size,
  o.product_tier,
  o.status,
  o.primary_color,
  o.logo_url,
  o.contract_reference,
  o.contract_starts_at,
  o.contract_ends_at,
  o.seats_limit,
  o.history_retention_policy,
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
-- 8) Registro de auditoria da migração
-- =========================================================

insert into public.organization_audit_logs (
  organization_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  metadata
)
select
  o.id,
  null,
  'organization.schema_fields_added',
  'organization',
  o.id,
  jsonb_build_object(
    'source', '013_governance_organization_fields.sql',
    'fields', jsonb_build_array(
      'organization_type',
      'municipality_name',
      'state_uf',
      'ibge_code',
      'municipality_size',
      'contract_reference',
      'history_retention_policy'
    ),
    'history_retention_policy', o.history_retention_policy
  )
from public.organizations o
where not exists (
  select 1
  from public.organization_audit_logs l
  where l.organization_id = o.id
    and l.action = 'organization.schema_fields_added'
    and l.metadata->>'source' = '013_governance_organization_fields.sql'
);

-- =========================================================
-- Fim
-- =========================================================