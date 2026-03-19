-- Módulo 6: Trial, assinatura e controle de acesso
-- Publ.IA / Supabase SQL
-- Cria tabelas básicas para controlar status de acesso e eventos de uso

create extension if not exists pgcrypto;

create table if not exists public.user_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,

  access_status text not null default 'trial_active'
    check (access_status in ('trial_active', 'trial_expired', 'subscription_active', 'subscription_expired')),

  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '15 days'),
  trial_message_limit integer not null default 75,

  subscription_plan text null
    check (subscription_plan in ('monthly', 'annual')),
  subscription_started_at timestamptz null,
  subscription_ends_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_access_user_id
  on public.user_access(user_id);

alter table public.user_access enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_access'
      and policyname = 'user_access_select_own'
  ) then
    create policy user_access_select_own
      on public.user_access
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_access'
      and policyname = 'user_access_insert_own'
  ) then
    create policy user_access_insert_own
      on public.user_access
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_access'
      and policyname = 'user_access_update_own'
  ) then
    create policy user_access_update_own
      on public.user_access
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;


create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  event_type text not null
    check (event_type in (
      'chat_message',
      'regenerate',
      'pdf_question',
      'pdf_upload',
      'export_xlsx',
      'public_share'
    )),

  conversation_id uuid null,
  pdf_file_id uuid null,

  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer generated always as (input_tokens + output_tokens) stored,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_user_id
  on public.usage_events(user_id);

create index if not exists idx_usage_events_created_at
  on public.usage_events(created_at desc);

create index if not exists idx_usage_events_user_event
  on public.usage_events(user_id, event_type);

alter table public.usage_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'usage_events'
      and policyname = 'usage_events_select_own'
  ) then
    create policy usage_events_select_own
      on public.usage_events
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'usage_events'
      and policyname = 'usage_events_insert_own'
  ) then
    create policy usage_events_insert_own
      on public.usage_events
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;


create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_access_set_updated_at on public.user_access;
create trigger trg_user_access_set_updated_at
before update on public.user_access
for each row
execute function public.set_updated_at();


create or replace function public.handle_new_user_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_access (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_user_access on auth.users;
create trigger on_auth_user_created_user_access
after insert on auth.users
for each row
execute function public.handle_new_user_access();


create or replace view public.user_access_summary as
select
  ua.user_id,
  ua.access_status,
  ua.trial_started_at,
  ua.trial_ends_at,
  ua.trial_message_limit,
  ua.subscription_plan,
  ua.subscription_started_at,
  ua.subscription_ends_at,

  coalesce(sum(
    case
      when ue.event_type in ('chat_message', 'regenerate', 'pdf_question') then 1
      else 0
    end
  ), 0) as messages_used,

  coalesce(sum(
    case
      when ue.event_type = 'pdf_upload' then 1
      else 0
    end
  ), 0) as pdf_uploads_used,

  coalesce(sum(ue.input_tokens), 0) as input_tokens_used,
  coalesce(sum(ue.output_tokens), 0) as output_tokens_used,
  coalesce(sum(ue.total_tokens), 0) as total_tokens_used
from public.user_access ua
left join public.usage_events ue
  on ue.user_id = ua.user_id
group by
  ua.user_id,
  ua.access_status,
  ua.trial_started_at,
  ua.trial_ends_at,
  ua.trial_message_limit,
  ua.subscription_plan,
  ua.subscription_started_at,
  ua.subscription_ends_at;

grant select on public.user_access_summary to authenticated;
