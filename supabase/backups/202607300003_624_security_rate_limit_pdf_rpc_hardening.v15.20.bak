-- Publ.IA — Supabase hardening lote 2A
-- Baseline funcional preservado: Governança v15.20
-- Escopo: check_rate_limit e sobrecargas de match_pdf_chunks.

begin;

-- 1) Rate limit: somente backend com service_role.
do $do$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'check_rate_limit'
  loop
    execute format('alter function %I.%I(%s) set search_path = pg_catalog, public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from anon', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from authenticated', r.nspname, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to service_role', r.nspname, r.proname, r.args);
  end loop;
end
$do$;

-- 2) Busca vetorial de PDFs: fixa search_path nas duas sobrecargas.
-- A sobrecarga antiga (3 argumentos, sem user_id) fica exclusiva do backend.
-- A sobrecarga atual (4 argumentos, com user_id) permanece disponível ao
-- authenticated porque Essencial/Estratégico ainda a chamam com sessão RLS.
do $do$
declare
  r record;
begin
  for r in
    select
      n.nspname,
      p.proname,
      p.pronargs,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'match_pdf_chunks'
  loop
    execute format('alter function %I.%I(%s) set search_path = pg_catalog, public, extensions', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from anon', r.nspname, r.proname, r.args);

    if r.pronargs = 3 then
      execute format('revoke all on function %I.%I(%s) from authenticated', r.nspname, r.proname, r.args);
      execute format('grant execute on function %I.%I(%s) to service_role', r.nspname, r.proname, r.args);
    else
      execute format('grant execute on function %I.%I(%s) to authenticated', r.nspname, r.proname, r.args);
      execute format('grant execute on function %I.%I(%s) to service_role', r.nspname, r.proname, r.args);
    end if;
  end loop;
end
$do$;

commit;
