-- Publ.IA — Supabase hardening lote 1
-- Baseline funcional preservado: Governança v15.20
-- Escopo: privilégios de funções, search_path e políticas do bucket pdf-files.

begin;

-- ---------------------------------------------------------------------------
-- 1) Funções auxiliares de organização/RLS
-- Mantêm SECURITY DEFINER e execução para authenticated/service_role.
-- ---------------------------------------------------------------------------
do $do$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
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
        'create_governance_organization'
      )
  loop
    execute format('alter function %I.%I(%s) set search_path = pg_catalog, public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from anon', r.nspname, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to authenticated', r.nspname, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to service_role', r.nspname, r.proname, r.args);
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- 2) Funções internas de trigger
-- Não devem ser chamadas por RPC por anon/authenticated.
-- ---------------------------------------------------------------------------
do $do$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'handle_new_user_access',
        'set_updated_at',
        'set_institutional_document_chunk_updated_at',
        'set_user_access_grants_updated_at'
      )
  loop
    execute format('alter function %I.%I(%s) set search_path = pg_catalog, public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from anon', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from authenticated', r.nspname, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to service_role', r.nspname, r.proname, r.args);
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- 3) Limpeza de signup tokens
-- Consumida apenas por backend com service_role no baseline atual.
-- ---------------------------------------------------------------------------
do $do$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cleanup_signup_tokens'
  loop
    execute format('alter function %I.%I(%s) set search_path = pg_catalog, public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from anon', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from authenticated', r.nspname, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to service_role', r.nspname, r.proname, r.args);
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- 4) Função administrativa de reset do trial Estratégico
-- Sem consumidor no código atual; restringida a service_role.
-- ---------------------------------------------------------------------------
do $do$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'reset_strategic_trial'
  loop
    execute format('alter function %I.%I(%s) set search_path = pg_catalog, public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from anon', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from authenticated', r.nspname, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to service_role', r.nspname, r.proname, r.args);
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- 5) Storage pdf-files
-- Remove políticas amplas/legadas e restringe authenticated ao próprio objeto.
-- O service_role preserva acesso administrativo por bypass de RLS.
-- ---------------------------------------------------------------------------
drop policy if exists "Allow anon select from pdf-files" on storage.objects;
drop policy if exists "Allow anon uploads to pdf-files" on storage.objects;
drop policy if exists "authenticated users can upload pdf-files" on storage.objects;
drop policy if exists "authenticated_can_upload_pdfs 1nzuh98_0" on storage.objects;
drop policy if exists "authenticated_can_upload_pdfs 1nzuh98_1" on storage.objects;
drop policy if exists "authenticated_can_upload_pdfs 1nzuh98_2" on storage.objects;
drop policy if exists "authenticated_can_upload_pdfs 1nzuh98_3" on storage.objects;
drop policy if exists "pdf_files_storage_select_own" on storage.objects;
drop policy if exists "pdf_files_storage_insert_own" on storage.objects;
drop policy if exists "pdf_files_storage_update_own" on storage.objects;
drop policy if exists "pdf_files_storage_delete_own" on storage.objects;

create policy "pdf_files_storage_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'pdf-files'
  and owner = auth.uid()
);

create policy "pdf_files_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pdf-files'
  and owner = auth.uid()
);

create policy "pdf_files_storage_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'pdf-files'
  and owner = auth.uid()
)
with check (
  bucket_id = 'pdf-files'
  and owner = auth.uid()
);

create policy "pdf_files_storage_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pdf-files'
  and owner = auth.uid()
);

commit;
