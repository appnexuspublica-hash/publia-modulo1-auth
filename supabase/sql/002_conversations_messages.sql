-- Garante que temos função para gerar UUID
create extension if not exists "pgcrypto";

-- =========================
-- Tabela de conversas
-- =========================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  is_shared boolean not null default false,
  share_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.conversations enable row level security;

create index if not exists idx_conversations_user_id
  on public.conversations (user_id);

create index if not exists idx_conversations_created_at
  on public.conversations (created_at desc);

-- Policies: cada usuário só mexe nas próprias conversas
create policy "Users can view own conversations"
  on public.conversations
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own conversations"
  on public.conversations
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own conversations"
  on public.conversations
  for update
  using (auth.uid() = user_id);

create policy "Users can delete own conversations"
  on public.conversations
  for delete
  using (auth.uid() = user_id);

-- =========================
-- Tabela de mensagens
-- =========================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create index if not exists idx_messages_conversation_id_created_at
  on public.messages (conversation_id, created_at);

-- Policies: usuário só vê/mexe em mensagens das próprias conversas
create policy "Users can view messages of own conversations"
  on public.messages
  for select
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can insert messages into own conversations"
  on public.messages
  for insert
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can delete messages from own conversations"
  on public.messages
  for delete
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );
