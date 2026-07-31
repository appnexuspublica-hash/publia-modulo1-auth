-- Rollback conservador — lote 3A
-- Use somente se houver incompatibilidade comprovada após a mudança.

begin;

do $do$
declare
  v_current_schema text;
  v_relocatable boolean;
begin
  select n.nspname, e.extrelocatable
    into v_current_schema, v_relocatable
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_trgm';

  if v_current_schema is null then
    raise exception 'A extensão pg_trgm não está instalada.';
  end if;

  if not v_relocatable and v_current_schema <> 'public' then
    raise exception 'A extensão pg_trgm não é relocável neste banco.';
  end if;

  if v_current_schema <> 'public' then
    execute 'alter extension pg_trgm set schema public';
  end if;
end
$do$;

-- O índice não é removido nem recriado: sua dependência é preservada por OID.

commit;
