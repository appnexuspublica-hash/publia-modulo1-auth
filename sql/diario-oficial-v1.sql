-- Diário Oficial v1
-- Criar no Supabase SQL Editor antes de usar a tela /governanca/diario-oficial.

create table if not exists public.governance_official_gazettes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  url text not null,
  active boolean not null default true,
  last_sync_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists governance_official_gazettes_organization_id_idx
on public.governance_official_gazettes (organization_id);

create unique index if not exists governance_official_gazettes_organization_url_unique
on public.governance_official_gazettes (organization_id, url);

alter table public.governance_official_gazettes enable row level security;

drop policy if exists "Governance users can read official gazettes from their organization"
on public.governance_official_gazettes;

create policy "Governance users can read official gazettes from their organization"
on public.governance_official_gazettes
for select
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = governance_official_gazettes.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

drop policy if exists "Governance admins can insert official gazettes"
on public.governance_official_gazettes;

create policy "Governance admins can insert official gazettes"
on public.governance_official_gazettes
for insert
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = governance_official_gazettes.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.technical_role in ('owner', 'admin', 'manager')
  )
);

drop policy if exists "Governance admins can update official gazettes"
on public.governance_official_gazettes;

create policy "Governance admins can update official gazettes"
on public.governance_official_gazettes
for update
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = governance_official_gazettes.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.technical_role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = governance_official_gazettes.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.technical_role in ('owner', 'admin', 'manager')
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_governance_official_gazettes_updated_at
on public.governance_official_gazettes;

create trigger set_governance_official_gazettes_updated_at
before update on public.governance_official_gazettes
for each row
execute function public.set_updated_at();
