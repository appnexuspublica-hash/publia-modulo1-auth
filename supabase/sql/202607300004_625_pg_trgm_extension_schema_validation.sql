-- Validação somente leitura — lote 3A

-- 1. Extensão no schema esperado.
select
  e.extname as extension_name,
  n.nspname as extension_schema,
  e.extversion as extension_version,
  e.extrelocatable as relocatable
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'pg_trgm';

-- Esperado: extension_schema = extensions.

-- 2. Índice trigram institucional presente, pronto e válido.
select
  ns.nspname as schema_name,
  tbl.relname as table_name,
  idx.relname as index_name,
  i.indisready as index_ready,
  i.indisvalid as index_valid,
  pg_get_indexdef(idx.oid) as index_definition
from pg_class idx
join pg_namespace ns on ns.oid = idx.relnamespace
join pg_index i on i.indexrelid = idx.oid
join pg_class tbl on tbl.oid = i.indrelid
where ns.nspname = 'public'
  and idx.relname = 'institutional_document_chunks_trgm_idx';

-- Esperado: index_ready = true e index_valid = true.

-- 3. Dependência do índice com objetos pertencentes à extensão pg_trgm.
select distinct
  idx_ns.nspname as index_schema,
  idx.relname as index_name,
  ext.extname as extension_name,
  ext_ns.nspname as extension_schema
from pg_class idx
join pg_namespace idx_ns on idx_ns.oid = idx.relnamespace
join pg_depend index_dep on index_dep.objid = idx.oid
join pg_depend extension_dep on extension_dep.objid = index_dep.refobjid
join pg_extension ext on ext.oid = extension_dep.refobjid
join pg_namespace ext_ns on ext_ns.oid = ext.extnamespace
where idx_ns.nspname = 'public'
  and idx.relname = 'institutional_document_chunks_trgm_idx'
  and ext.extname = 'pg_trgm';

-- A consulta acima pode retornar zero linhas conforme a cadeia interna de
-- dependências da versão do PostgreSQL. A validação determinante é a extensão
-- em extensions e o índice pronto/válido nas consultas 1 e 2.
