-- Publ.IA — Supabase hardening lote 3A
-- Baseline funcional preservado: Governança v15.20
-- Escopo: mover a extensão pg_trgm de public para extensions.
--
-- A extensão é relocável. O PostgreSQL mantém as dependências por OID,
-- portanto o índice GIN existente continua vinculado ao opclass correto
-- sem necessidade de remoção ou recriação.

begin;

create schema if not exists extensions;

-- Restringe criação de objetos no schema de extensões.
revoke create on schema extensions from public;
grant usage on schema extensions to postgres, anon, authenticated, service_role;

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

  if not v_relocatable and v_current_schema <> 'extensions' then
    raise exception 'A extensão pg_trgm não é relocável neste banco.';
  end if;

  if v_current_schema <> 'extensions' then
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end
$do$;

-- Confirma que o índice institucional crítico continua presente e válido.
do $do$
declare
  v_index_valid boolean;
begin
  select i.indisvalid and i.indisready
    into v_index_valid
  from pg_class idx
  join pg_namespace ns on ns.oid = idx.relnamespace
  join pg_index i on i.indexrelid = idx.oid
  where ns.nspname = 'public'
    and idx.relname = 'institutional_document_chunks_trgm_idx';

  if v_index_valid is distinct from true then
    raise exception 'O índice institutional_document_chunks_trgm_idx está ausente ou inválido.';
  end if;
end
$do$;

commit;
