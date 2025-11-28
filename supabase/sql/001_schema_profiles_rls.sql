
create extension if not exists pgcrypto;
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cpf_cnpj text not null unique,
  nome text not null,
  email text not null,
  telefone text,
  cidade_uf text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_profiles_user on public.profiles(user_id);
create unique index if not exists idx_profiles_cpfcnpj on public.profiles(cpf_cnpj);
alter table public.profiles enable row level security;
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner" on public.profiles for select using (auth.uid() = user_id);
drop policy if exists "Profiles insert blocked for normal users" on public.profiles;
create policy "Profiles insert blocked for normal users" on public.profiles for insert with check (false);
drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner" on public.profiles for update using (auth.uid() = user_id);
create or replace view public.vw_profiles_lookup as select cpf_cnpj, email, user_id from public.profiles;
