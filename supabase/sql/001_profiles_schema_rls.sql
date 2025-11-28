-- supabase/sql/001_profiles_schema_rls.sql

-- Cria extensão uuid-ossp se necessário (opcional)
-- create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cpf_cnpj text,
  nome text not null,
  email text not null unique,
  telefone text,
  cidade_uf text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger de updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;

-- Políticas básicas
drop policy if exists "Profiles select self" on public.profiles;
create policy "Profiles select self"
on public.profiles for select
using ( auth.uid() = user_id );

drop policy if exists "Profiles update self" on public.profiles;
create policy "Profiles update self"
on public.profiles for update
using ( auth.uid() = user_id );

drop policy if exists "Profiles insert admin only" on public.profiles;
create policy "Profiles insert admin only"
on public.profiles for insert
with check ( auth.role() = 'service_role' );

-- Índices auxiliares
create index if not exists idx_profiles_email on public.profiles (email);
create index if not exists idx_profiles_nome on public.profiles (nome);
