-- Publ.IA Governança v12.7
-- Restringe mensagens confiáveis ao backend.
--
-- Objetivos:
-- 1. Usuários autenticados podem inserir/alterar apenas mensagens próprias
--    com role = 'user'.
-- 2. Mensagens role = 'assistant' ou 'system' só podem ser persistidas por
--    uma conexão privilegiada que ignore RLS (service_role), após a
--    autenticação e autorização realizadas pela API.
-- 3. A política é RESTRICTIVE para complementar, sem depender do nome, as
--    políticas permissivas já existentes.

begin;

alter table public.governance_messages enable row level security;

drop policy if exists "Authenticated users can insert only own user messages"
  on public.governance_messages;

create policy "Authenticated users can insert only own user messages"
  on public.governance_messages
  as restrictive
  for insert
  to authenticated
  with check (
    role = 'user'
    and user_id = auth.uid()
  );

drop policy if exists "Authenticated users can update only own user messages"
  on public.governance_messages;

create policy "Authenticated users can update only own user messages"
  on public.governance_messages
  as restrictive
  for update
  to authenticated
  using (
    role = 'user'
    and user_id = auth.uid()
  )
  with check (
    role = 'user'
    and user_id = auth.uid()
  );

comment on policy "Authenticated users can insert only own user messages"
  on public.governance_messages is
  'Política restritiva: clientes autenticados só inserem mensagens próprias com role=user. assistant/system exigem backend service_role.';

comment on policy "Authenticated users can update only own user messages"
  on public.governance_messages is
  'Política restritiva: impede transformar mensagens de usuário em assistant/system ou alterar mensagens confiáveis via cliente autenticado.';

do $$
declare
  insert_policy_count integer;
  update_policy_count integer;
begin
  select count(*)
    into insert_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'governance_messages'
    and policyname = 'Authenticated users can insert only own user messages'
    and permissive = 'RESTRICTIVE'
    and cmd = 'INSERT'
    and 'authenticated' = any(roles);

  select count(*)
    into update_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'governance_messages'
    and policyname = 'Authenticated users can update only own user messages'
    and permissive = 'RESTRICTIVE'
    and cmd = 'UPDATE'
    and 'authenticated' = any(roles);

  if insert_policy_count <> 1 or update_policy_count <> 1 then
    raise exception
      'Falha ao validar as políticas restritivas de governance_messages.';
  end if;
end;
$$;

commit;
