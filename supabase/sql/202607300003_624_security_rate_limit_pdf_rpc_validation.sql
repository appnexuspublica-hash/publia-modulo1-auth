-- Validação somente leitura — lote 2A

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.pronargs as argument_count,
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security_mode,
  coalesce(array_to_string(p.proconfig, '; '), '') as configuration
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('check_rate_limit', 'match_pdf_chunks')
order by p.proname, p.pronargs;

select
  routine_name,
  specific_name,
  grantee,
  privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name in ('check_rate_limit', 'match_pdf_chunks')
order by routine_name, specific_name, grantee;

-- Esperado:
-- check_rate_limit: EXECUTE somente para service_role (e owner postgres).
-- match_pdf_chunks com 3 args: somente service_role (e owner postgres).
-- match_pdf_chunks com 4 args: authenticated e service_role (e owner postgres).
-- Nenhuma das funções deve conceder EXECUTE a PUBLIC ou anon.
