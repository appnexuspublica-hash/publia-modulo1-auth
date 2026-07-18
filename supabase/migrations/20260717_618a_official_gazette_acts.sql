-- Módulo 6.1.8-A — índice estruturado de atos do Diário Oficial
-- Aplicar no SQL Editor do Supabase antes de reprocessar/reindexar edições.

create table if not exists public.governance_official_gazette_acts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.governance_official_gazette_documents(id) on delete cascade,
  chunk_id uuid not null references public.governance_official_gazette_chunks(id) on delete cascade,
  act_type text not null,
  act_number text,
  act_year integer,
  edition_number text,
  publication_date date,
  page_number integer,
  title text not null,
  content text not null,
  normalized_content text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint governance_official_gazette_acts_status_check
    check (status in ('active', 'inactive', 'review'))
);

create unique index if not exists governance_official_gazette_acts_chunk_unique
  on public.governance_official_gazette_acts (chunk_id);

create index if not exists governance_official_gazette_acts_structured_lookup_idx
  on public.governance_official_gazette_acts
  (organization_id, act_type, act_number, act_year);

create index if not exists governance_official_gazette_acts_document_idx
  on public.governance_official_gazette_acts (organization_id, document_id);

create index if not exists governance_official_gazette_acts_edition_idx
  on public.governance_official_gazette_acts
  (organization_id, edition_number, publication_date);

create index if not exists governance_official_gazette_acts_normalized_content_idx
  on public.governance_official_gazette_acts
  using gin (to_tsvector('portuguese', normalized_content));

alter table public.governance_official_gazette_acts enable row level security;

drop policy if exists "Members can read official gazette acts"
  on public.governance_official_gazette_acts;

create policy "Members can read official gazette acts"
  on public.governance_official_gazette_acts
  for select
  using (
    exists (
      select 1
      from public.organization_members member
      where member.organization_id = governance_official_gazette_acts.organization_id
        and member.user_id = auth.uid()
        and member.status = 'active'
    )
  );

drop policy if exists "Managers can write official gazette acts"
  on public.governance_official_gazette_acts;

create policy "Managers can write official gazette acts"
  on public.governance_official_gazette_acts
  for all
  using (
    exists (
      select 1
      from public.organization_members member
      where member.organization_id = governance_official_gazette_acts.organization_id
        and member.user_id = auth.uid()
        and member.status = 'active'
        and member.technical_role in ('owner', 'admin', 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members member
      where member.organization_id = governance_official_gazette_acts.organization_id
        and member.user_id = auth.uid()
        and member.status = 'active'
        and member.technical_role in ('owner', 'admin', 'manager')
    )
  );
