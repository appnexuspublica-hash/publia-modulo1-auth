-- 1) As sete funções públicas devem ser SECURITY INVOKER.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security_mode,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'can_manage_organization_conversations',
    'create_governance_conversation',
    'create_governance_organization',
    'current_organization_technical_role',
    'has_organization_role_at_least',
    'is_active_organization_member',
    'is_organization_member'
  )
order by p.proname;

-- 2) Implementações privilegiadas devem existir somente no schema private.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security_mode,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in (
    'can_manage_organization_conversations',
    'create_governance_conversation',
    'create_governance_organization',
    'current_organization_technical_role',
    'has_organization_role_at_least',
    'is_active_organization_member',
    'is_organization_member'
  )
order by p.proname;

-- 3) Grants públicos: anon/PUBLIC não podem executar; authenticated não pode criar organização.
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.role_routine_grants
where routine_schema in ('public', 'private')
  and routine_name in (
    'can_manage_organization_conversations',
    'create_governance_conversation',
    'create_governance_organization',
    'current_organization_technical_role',
    'has_organization_role_at_least',
    'is_active_organization_member',
    'is_organization_member'
  )
order by routine_schema, routine_name, grantee;

-- 4) Nenhuma função SECURITY DEFINER deve continuar exposta no schema public.
select count(*) as exposed_security_definer_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and p.proname in (
    'can_manage_organization_conversations',
    'create_governance_conversation',
    'create_governance_organization',
    'current_organization_technical_role',
    'has_organization_role_at_least',
    'is_active_organization_member',
    'is_organization_member'
  );
