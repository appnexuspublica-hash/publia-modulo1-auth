-- 008_align_sql_to_code.sql
-- Alinha schema do Supabase com o código atual (Next.js routes/actions)

-- =========================
-- A) pdf_files: alinhar colunas ao código
-- =========================
do $$
begin
  -- Renomeia colunas antigas para as usadas no código (se existirem)
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='pdf_files' and column_name='original_name'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='pdf_files' and column_name='file_name'
  ) then
    execute 'alter table public.pdf_files rename column original_name to file_name';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='pdf_files' and column_name='size_bytes'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='pdf_files' and column_name='file_size'
  ) then
    execute 'alter table public.pdf_files rename column size_bytes to file_size';
  end if;

  -- Garante colunas exigidas pelo código (caso não existam)
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pdf_files' and column_name='file_name'
  ) then
    execute 'alter table public.pdf_files add column file_name text null';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pdf_files' and column_name='file_size'
  ) then
    execute 'alter table public.pdf_files add column file_size bigint null';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pdf_files' and column_name='storage_path'
  ) then
    execute 'alter table public.pdf_files add column storage_path text not null default ''''';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pdf_files' and column_name='openai_file_id'
  ) then
    execute 'alter table public.pdf_files add column openai_file_id text null';
  end if;

  -- (Opcional) Campos já existentes no seu SQL original: mantém, não remove.
  -- extracted_text/mime_type/storage_bucket/etc continuam úteis.
end $$;

-- Índices úteis para o fluxo do /api/chat (pegar último PDF por conversa)
create index if not exists pdf_files_conv_user_created_idx
  on public.pdf_files (conversation_id, user_id, created_at desc);

-- =========================
-- B) Rate limit & cleanup: RPCs do jeito que o código chama
-- =========================

-- Tabela de eventos (se já existir, mantém)
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

-- Helper: extrair IP do request (PostgREST/Supabase expõe request.headers em current_setting)
create or replace function public._client_ip_from_request()
returns inet
language plpgsql
security definer
set search_path = public
as $$
declare
  hdr jsonb;
  xff text;
  rip text;
begin
  hdr := nullif(current_setting('request.headers', true), '')::jsonb;

  if hdr ? 'x-forwarded-for' then
    xff := hdr->>'x-forwarded-for';
    if xff is not null and btrim(xff) <> '' then
      -- pega o primeiro IP da lista
      return split_part(xff, ',', 1)::inet;
    end if;
  end if;

  if hdr ? 'x-real-ip' then
    rip := hdr->>'x-real-ip';
    if rip is not null and btrim(rip) <> '' then
      return rip::inet;
    end if;
  end if;

  -- fallback
  return '0.0.0.0'::inet;
exception
  when others then
    return '0.0.0.0'::inet;
end;
$$;

-- FUNÇÃO NOVA: exatamente como o código chama
-- Código espera: data.allowed (não boolean puro)
create or replace function public.check_rate_limit(
  p_key text,
  p_limit int default 10,
  p_window_seconds int default 60
)
returns table(allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip inet;
  v_count int;
begin
  v_ip := public._client_ip_from_request();

  select count(*)
    into v_count
  from public.rate_limit_events
  where key = p_key
    and ip = v_ip
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    allowed := false;
    return next;
    return;
  end if;

  insert into public.rate_limit_events(key, ip) values (p_key, v_ip);

  allowed := true;
  return next;
end;
$$;

-- FUNÇÃO NOVA: cleanup com parâmetros (como o código chama)
create or replace function public.cleanup_signup_tokens(
  p_expired_older_minutes int default 60,
  p_used_older_minutes int default 1440,
  p_batch int default 200
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove expirados há pelo menos p_expired_older_minutes
  delete from public.signup_tokens
  where ctid in (
    select ctid
    from public.signup_tokens
    where expires_at < now() - make_interval(mins => p_expired_older_minutes)
    limit p_batch
  );

  -- Remove usados há pelo menos p_used_older_minutes
  delete from public.signup_tokens
  where ctid in (
    select ctid
    from public.signup_tokens
    where used_at is not null
      and used_at < now() - make_interval(mins => p_used_older_minutes)
    limit p_batch
  );
end;
$$;

-- Wrappers de compatibilidade (se algum lugar antigo ainda chamar as versões antigas)
-- Antiga check_rate_limit(p_key, p_ip, p_limit, p_window_seconds) returns boolean
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

-- Antiga cleanup_signup_tokens() returns void
create or replace function public.cleanup_signup_tokens()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cleanup_signup_tokens(60, 1440, 200);
end;
$$;

grant execute on function public.check_rate_limit(text, int, int) to authenticated, anon;
grant execute on function public.cleanup_signup_tokens(int, int, int) to authenticated, anon;

grant execute on function public.check_rate_limit(text, inet, int, int) to authenticated, anon;
grant execute on function public.cleanup_signup_tokens() to authenticated, anon;
