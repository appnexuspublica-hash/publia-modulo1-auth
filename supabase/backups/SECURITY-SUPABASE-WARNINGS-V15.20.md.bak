# Publ.IA — Supabase Security Warnings — Lote 1

Baseline funcional preservado: Governança v15.20.

## Escopo aplicado

- Revogação de execução herdada por `PUBLIC` e de `anon` em funções sensíveis.
- Preservação de `authenticated` apenas nas funções necessárias ao RLS e à criação controlada de organizações/conversas.
- Restrição de funções internas, limpeza de tokens e reset administrativo a `service_role`.
- Fixação de `search_path` em `pg_catalog, public` nas funções do lote.
- Substituição das políticas amplas do bucket `pdf-files` por políticas baseadas em `owner = auth.uid()`.
- Remoção integral de acesso anônimo ao bucket `pdf-files`.

## Fora deste lote

- `check_rate_limit`.
- Sobrecargas de `match_pdf_chunks`.
- Extensão `pg_trgm`.
- Proteção contra senhas vazadas no painel do Auth.

Esses itens exigem lote separado por terem maior potencial de impacto funcional ou configuração externa ao schema.
