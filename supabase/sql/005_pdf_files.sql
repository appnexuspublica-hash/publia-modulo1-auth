-- 005_pdf_files.sql
-- Registro dos PDFs enviados (metadados + vínculo com usuário)

create extension if not exists pgcrypto;

create table if not exists public.pdf_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid null references public.conversations(id) on delete set null,

  storage_bucket text not null default 'pdf-files',
  storage_path text not null,
  original_name text null,
  mime_type text null,
  size_bytes bigint null,

  extracted_text text null,
  openai_file_id text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pdf_files_user_created_idx on public.pdf_files (user_id, created_at desc);
create index if not exists pdf_files_conversation_idx on public.pdf_files (conversation_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as 
begin
  new.updated_at = now();
  return new;
end;
;

drop trigger if exists trg_pdf_files_updated_at on public.pdf_files;
create trigger trg_pdf_files_updated_at
before update on public.pdf_files
for each row execute function public.set_updated_at();

alter table public.pdf_files enable row level security;

drop policy if exists "pdf_files_select_own" on public.pdf_files;
create policy "pdf_files_select_own"
on public.pdf_files for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "pdf_files_insert_own" on public.pdf_files;
create policy "pdf_files_insert_own"
on public.pdf_files for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "pdf_files_update_own" on public.pdf_files;
create policy "pdf_files_update_own"
on public.pdf_files for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "pdf_files_delete_own" on public.pdf_files;
create policy "pdf_files_delete_own"
on public.pdf_files for delete
to authenticated
using (user_id = auth.uid());
