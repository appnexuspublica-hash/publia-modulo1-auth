-- Validação somente leitura após a migration 202607300001_622.

-- A. As três views devem retornar security_invoker=true.
select
  n.nspname as schema_name,
  c.relname as object_name,
  c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'user_access_summary',
    'user_access_grants_summary',
    'my_organizations'
  )
order by c.relname;

-- B. governance_audit_events deve ter rls_enabled=true.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'governance_audit_events';

-- C. anon não deve possuir privilégios nos quatro objetos.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'user_access_summary',
    'user_access_grants_summary',
    'my_organizations',
    'governance_audit_events'
  )
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- D. Não deve existir política permissiva para anon/authenticated na auditoria.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'governance_audit_events';
