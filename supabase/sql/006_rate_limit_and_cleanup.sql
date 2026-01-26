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
as 
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
;

create or replace function public.cleanup_signup_tokens()
returns void
language plpgsql
security definer
set search_path = public
as 
begin
  delete from public.signup_tokens
  where expires_at < now()
     or (used_at is not null and used_at < now() - interval '30 days');
end;
;

grant execute on function public.check_rate_limit(text, inet, int, int) to authenticated, anon;
grant execute on function public.cleanup_signup_tokens() to authenticated, anon;
