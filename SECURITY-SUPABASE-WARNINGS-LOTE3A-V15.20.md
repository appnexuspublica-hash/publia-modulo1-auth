# Supabase Security Warnings — Lote 3A

Baseline preservado: Governança v15.20.

## Escopo

- Move `pg_trgm` do schema `public` para `extensions`.
- Mantém o índice `public.institutional_document_chunks_trgm_idx` sem reconstrução.
- Não altera funções, prompts, provedores, recuperação de fontes, persistência ou comportamento dos chats.

## Decisão técnica

`pg_trgm` é uma extensão relocável. Objetos dependentes são vinculados por OID; por isso, mover a extensão não exige apagar ou recriar o índice GIN. A migration interrompe a transação se a extensão não existir, não for relocável ou se o índice institucional estiver ausente/inválido.

## Validação

Execute `supabase/sql/202607300004_625_pg_trgm_extension_schema_validation.sql` após aplicar a migration.

Resultado esperado:

- `pg_trgm` no schema `extensions`;
- índice `institutional_document_chunks_trgm_idx` pronto e válido;
- busca institucional sem regressão.
