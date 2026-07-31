-- Módulo 6.1.8-B — chunks persistentes da Base Institucional

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;

create table if not exists public.institutional_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.institutional_documents(id) on delete cascade,
  organization_id uuid not null,
  page integer,
  chunk_index integer not null default 0,
  content text not null,
  normalized_content text not null,
  keywords text[] not null default '{}',
  embedding vector,
  status text not null default 'pending_review'
    check (status in ('active', 'pending_review', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists institutional_document_chunks_document_idx
  on public.institutional_document_chunks (document_id, chunk_index);

create index if not exists institutional_document_chunks_org_status_idx
  on public.institutional_document_chunks (organization_id, status);

create index if not exists institutional_document_chunks_keywords_idx
  on public.institutional_document_chunks using gin (keywords);

create index if not exists institutional_document_chunks_fts_idx
  on public.institutional_document_chunks
  using gin (to_tsvector('portuguese', coalesce(normalized_content, '')));

create index if not exists institutional_document_chunks_trgm_idx
  on public.institutional_document_chunks
  using gin (normalized_content gin_trgm_ops);

alter table public.institutional_document_chunks enable row level security;

drop policy if exists "institutional chunks select by organization" on public.institutional_document_chunks;
create policy "institutional chunks select by organization"
on public.institutional_document_chunks
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members members
    where members.organization_id = institutional_document_chunks.organization_id
      and members.user_id = auth.uid()
      and coalesce(members.status, 'active') = 'active'
  )
);

drop policy if exists "institutional chunks insert by managers" on public.institutional_document_chunks;
create policy "institutional chunks insert by managers"
on public.institutional_document_chunks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members members
    where members.organization_id = institutional_document_chunks.organization_id
      and members.user_id = auth.uid()
      and coalesce(members.status, 'active') = 'active'
      and members.technical_role in ('owner', 'admin', 'manager')
  )
);

drop policy if exists "institutional chunks update by managers" on public.institutional_document_chunks;
create policy "institutional chunks update by managers"
on public.institutional_document_chunks
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members members
    where members.organization_id = institutional_document_chunks.organization_id
      and members.user_id = auth.uid()
      and coalesce(members.status, 'active') = 'active'
      and members.technical_role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.organization_members members
    where members.organization_id = institutional_document_chunks.organization_id
      and members.user_id = auth.uid()
      and coalesce(members.status, 'active') = 'active'
      and members.technical_role in ('owner', 'admin', 'manager')
  )
);

drop policy if exists "institutional chunks delete by managers" on public.institutional_document_chunks;
create policy "institutional chunks delete by managers"
on public.institutional_document_chunks
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members members
    where members.organization_id = institutional_document_chunks.organization_id
      and members.user_id = auth.uid()
      and coalesce(members.status, 'active') = 'active'
      and members.technical_role in ('owner', 'admin', 'manager')
  )
);

create or replace function public.set_institutional_document_chunk_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists institutional_document_chunks_set_updated_at
  on public.institutional_document_chunks;

create trigger institutional_document_chunks_set_updated_at
before update on public.institutional_document_chunks
for each row
execute function public.set_institutional_document_chunk_updated_at();
