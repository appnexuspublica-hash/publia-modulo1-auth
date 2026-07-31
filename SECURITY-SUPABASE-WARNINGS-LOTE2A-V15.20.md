# Publ.IA — Supabase Security Warnings — Lote 2A

Baseline preservado: Governança v15.20.

## Alterações

- `check_rate_limit` passou a ser chamado pelo backend com `service_role`.
- Execução pública, anônima e autenticada de `check_rate_limit` foi revogada.
- Governança passou a usar a sobrecarga de `match_pdf_chunks` que exige `user_id`.
- `search_path` das sobrecargas foi fixado em `pg_catalog, public, extensions`.
- A sobrecarga antiga de três argumentos foi restrita ao `service_role`.
- A sobrecarga moderna permanece para `authenticated` porque Essencial e Estratégico a utilizam sob RLS.

Nenhum prompt, provedor, fonte, regra de resposta ou persistência de conversa foi alterado.
