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
