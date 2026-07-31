# Correção do Supabase Security Advisor — baseline Governança v15.20

## Escopo

A alteração atua apenas em privilégios e RLS do banco. Não modifica regras de resposta, provedores, fontes, persistência de conversas, arquitetura do chat ou comportamento dos módulos.

## Arquivos

- `supabase/migrations/202607300001_622_security_advisor_hardening.sql`
- `supabase/rollback/202607300001_622_security_advisor_hardening.rollback.sql`
- `supabase/sql/202607300001_622_security_advisor_validation.sql`

## Objetos protegidos

- `public.user_access_summary`
- `public.user_access_grants_summary`
- `public.my_organizations`
- `public.governance_audit_events`

## Decisões

As três views passam a `security_invoker=true`, deixam de aceitar `anon` e mantêm somente `SELECT` para `authenticated` e `service_role`.

`governance_audit_events` recebe RLS, perde todos os privilégios de `anon` e `authenticated` e permanece acessível ao backend com `service_role`. Não foi criada política para clientes comuns porque o baseline v15.20 não contém consumidor dessa tabela.

O rollback é deliberadamente seguro: pode reverter `security_invoker` das views, mas não reabre acesso anônimo nem desabilita o RLS da tabela de auditoria.

## Prompt específico de teste

> Execute uma verificação de regressão do Publ.IA após a migration de segurança. Entre com um usuário comum e confirme que o acesso ao Essencial, Estratégico e Governança continua respeitando plano, trial e limites. Confirme que o usuário vê somente suas próprias concessões de acesso e apenas as organizações em que possui vínculo ativo. Em seguida, tente consultar anonimamente `user_access_summary`, `user_access_grants_summary`, `my_organizations` e `governance_audit_events`; todas devem negar acesso ou retornar ausência de autorização. Com dois usuários distintos, confirme que nenhum deles consegue consultar dados de acesso do outro. Por fim, faça uma pergunta simples em cada módulo e confirme que resposta, histórico, streaming e compartilhamento permanecem iguais ao baseline Governança v15.20.
