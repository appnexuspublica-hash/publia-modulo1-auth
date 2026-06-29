-- supabase/sql/011_official_sources_priority.sql
-- Execute uma vez no Supabase SQL Editor antes de aplicar os novos arquivos,
-- caso a coluna priority ainda não exista na tabela official_sources.

alter table public.official_sources
  add column if not exists priority text not null default 'medium'
  check (priority in ('high', 'medium', 'low'));

create index if not exists idx_official_sources_org_priority
  on public.official_sources(organization_id, priority);

-- Corrige registros antigos criados como pending_review para entrarem no fluxo atual.
update public.official_sources
set status = 'active',
    reviewed_at = coalesce(reviewed_at, now())
where status = 'pending_review';
