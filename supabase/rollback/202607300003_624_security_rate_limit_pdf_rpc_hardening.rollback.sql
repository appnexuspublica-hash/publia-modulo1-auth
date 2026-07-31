-- Rollback operacional seguro do lote 2A.
-- Use somente se o código também for revertido para os backups correspondentes.
-- Não restaura acesso de anon nem de PUBLIC.

begin;

do $do$
declare r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'check_rate_limit'
  loop
    execute format('grant execute on function %I.%I(%s) to authenticated', r.nspname, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to service_role', r.nspname, r.proname, r.args);
  end loop;
end $do$;

-- A sobrecarga moderna de match_pdf_chunks permanece com authenticated.
-- A antiga continua fechada por segurança; reverta o código para o fallback de
-- texto extraído caso haja incompatibilidade, em vez de reabrir a RPC insegura.

commit;
