$ErrorActionPreference = "Stop"

# Garante pastas
New-Item -ItemType Directory -Force -Path ".\supabase\sql" | Out-Null
New-Item -ItemType Directory -Force -Path ".\supabase\sql\dev" | Out-Null
New-Item -ItemType Directory -Force -Path ".\supabase\sql\legacy" | Out-Null

# 004_signup_tokens.sql
@"
-- 004_signup_tokens.sql
-- Tabela para controlar cadastro via token (convite)

create extension if not exists pgcrypto;

create table if not exists public.signup_tokens (
  token text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_by uuid null,
  used_at timestamptz null,
  used_by uuid null,
  note text null
);

create index if not exists signup_tokens_expires_at_idx on public.signup_tokens (expires_at);
create index if not exists signup_tokens_used_at_idx on public.signup_tokens (used_at);

alter table public.signup_tokens enable row level security;

revoke all on public.signup_tokens from anon, authenticated;
"@ | Set-Content -Encoding UTF8 ".\supabase\sql\004_signup_tokens.sql"

# 005_pdf_files.sql
@"
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
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
"@ | Set-Content -Encoding UTF8 ".\supabase\sql\005_pdf_files.sql"

# 006_rate_limit_and_cleanup.sql
@"
-- 006_rate_limit_and_cleanup.sql
-- Rate limit simples (best-effort) + limpeza de signup_tokens

create table if not exists public.rate_limit_events (
  id bigserial primary key,
  key text not null,
  ip inet not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_key_ip_time_idx
  on public.rate_limit_events (key, ip, created_at desc);

alter table public.rate_limit_events enable row level security;

revoke all on public.rate_limit_events from anon, authenticated;

create or replace function public.check_rate_limit(
  p_key text,
  p_ip inet,
  p_limit int default 10,
  p_window_seconds int default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*)
    into v_count
  from public.rate_limit_events
  where key = p_key
    and ip = p_ip
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_events(key, ip) values (p_key, p_ip);
  return true;
end;
$$;

create or replace function public.cleanup_signup_tokens()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.signup_tokens
  where expires_at < now()
     or (used_at is not null and used_at < now() - interval '30 days');
end;
$$;

grant execute on function public.check_rate_limit(text, inet, int, int) to authenticated, anon;
grant execute on function public.cleanup_signup_tokens() to authenticated, anon;
"@ | Set-Content -Encoding UTF8 ".\supabase\sql\006_rate_limit_and_cleanup.sql"

# 007_storage_policies_pdf_files.sql (opcional)
@"
-- 007_storage_policies_pdf_files.sql
-- Policies para o bucket 'pdf-files'
-- Regra simples: usuário autenticado só acessa objetos em que ele é owner.

alter table storage.objects enable row level security;

drop policy if exists "pdf_files_storage_select_own" on storage.objects;
create policy "pdf_files_storage_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'pdf-files'
  and owner = auth.uid()
);

drop policy if exists "pdf_files_storage_insert_own" on storage.objects;
create policy "pdf_files_storage_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pdf-files'
  and owner = auth.uid()
);

drop policy if exists "pdf_files_storage_delete_own" on storage.objects;
create policy "pdf_files_storage_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pdf-files'
  and owner = auth.uid()
);
"@ | Set-Content -Encoding UTF8 ".\supabase\sql\007_storage_policies_pdf_files.sql"

Write-Host "OK! Arquivos SQL gerados/atualizados em .\supabase\sql\"
