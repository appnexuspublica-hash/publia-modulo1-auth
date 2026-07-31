-- Rollback manual da migration Publ.IA Governança v12.7.
-- Execute somente se for necessário reverter a restrição de papéis.
begin;

drop policy if exists "Authenticated users can insert only own user messages"
  on public.governance_messages;

drop policy if exists "Authenticated users can update only own user messages"
  on public.governance_messages;

commit;
