-- ⚠️ DEV ONLY — NÃO RODAR EM PRODUÇÃO
-- Este arquivo REMOVE policies seguras e cria policies abertas (using true / with check true).
-- Use apenas em ambiente local para depuração.

-- MODO DEV: policies abertas para conversas e mensagens
-- ATENÇÃO: antes de ir para produção, vamos refinar isso.

-- ================
-- CONVERSATIONS
-- ================

drop policy if exists "Users can view own conversations" on public.conversations;
drop policy if exists "Users can insert own conversations" on public.conversations;
drop policy if exists "Users can update own conversations" on public.conversations;
drop policy if exists "Users can delete own conversations" on public.conversations;

create policy "Dev all can view conversations"
  on public.conversations
  for select
  using (true);

create policy "Dev all can insert conversations"
  on public.conversations
  for insert
  with check (true);

create policy "Dev all can update conversations"
  on public.conversations
  for update
  using (true);

create policy "Dev all can delete conversations"
  on public.conversations
  for delete
  using (true);

-- ================
-- MESSAGES
-- ================

drop policy if exists "Users can view messages of own conversations" on public.messages;
drop policy if exists "Users can insert messages into own conversations" on public.messages;
drop policy if exists "Users can delete messages from own conversations" on public.messages;

create policy "Dev all can view messages"
  on public.messages
  for select
  using (true);

create policy "Dev all can insert messages"
  on public.messages
  for insert
  with check (true);

create policy "Dev all can delete messages"
  on public.messages
  for delete
  using (true);
