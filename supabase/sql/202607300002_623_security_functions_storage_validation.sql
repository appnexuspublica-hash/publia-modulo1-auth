-- Validação somente leitura — lote 1 de hardening.

-- A) Grants efetivos das funções auditadas.
select
  routine_name,
  grantee,
  privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name in (
    'can_manage_organization_conversations',
    'current_organization_technical_role',
    'has_organization_role_at_least',
    'is_active_organization_member',
    'is_organization_member',
    'create_governance_conversation',
    'create_governance_organization',
    'handle_new_user_access',
    'set_updated_at',
    'set_institutional_document_chunk_updated_at',
    'set_user_access_grants_updated_at',
    'cleanup_signup_tokens',
    'reset_strategic_trial'
  )
order by routine_name, grantee;

-- B) search_path das funções auditadas.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security_mode,
  coalesce(array_to_string(p.proconfig, '; '), '') as configuration
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'can_manage_organization_conversations',
    'current_organization_technical_role',
    'has_organization_role_at_least',
    'is_active_organization_member',
    'is_organization_member',
    'create_governance_conversation',
    'create_governance_organization',
    'handle_new_user_access',
    'set_updated_at',
    'set_institutional_document_chunk_updated_at',
    'set_user_access_grants_updated_at',
    'cleanup_signup_tokens',
    'reset_strategic_trial'
  )
order by function_name, identity_arguments;

-- C) Políticas atuais do bucket pdf-files.
select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    coalesce(qual, '') ilike '%pdf-files%'
    or coalesce(with_check, '') ilike '%pdf-files%'
  )
order by policyname;

-- Esperado:
-- 1. Nenhum grant para PUBLIC/anon nas funções listadas.
-- 2. authenticated apenas nas auxiliares e nas funções de criação.
-- 3. cleanup/reset/triggers apenas para service_role (além do owner implícito).
-- 4. search_path contendo pg_catalog, public.
-- 5. Exatamente quatro políticas pdf_files_storage_* para authenticated,
--    todas condicionadas por bucket_id='pdf-files' e owner=auth.uid().
