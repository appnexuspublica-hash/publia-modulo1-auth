-- Publ.IA — Security Advisor hardening
-- Baseline funcional preservado: Governança v15.20
-- Escopo: três views SECURITY DEFINER e governance_audit_events sem RLS.
-- Idempotente: operações condicionadas à existência e ao tipo dos objetos.

begin;

-- 1) Views: executar com os privilégios do chamador para que o RLS das
-- tabelas subjacentes seja aplicado. Remover acesso anônimo e manter apenas
-- leitura para usuários autenticados e service_role.
do $migration$
declare
  view_name text;
begin
  foreach view_name in array array[
    'user_access_summary',
    'user_access_grants_summary',
    'my_organizations'
  ]
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = view_name
        and c.relkind = 'v'
    ) then
      execute format(
        'alter view public.%I set (security_invoker = true)',
        view_name
      );

      execute format(
        'revoke all privileges on table public.%I from anon',
        view_name
      );
      execute format(
        'revoke all privileges on table public.%I from authenticated',
        view_name
      );
      execute format(
        'revoke all privileges on table public.%I from service_role',
        view_name
      );

      execute format(
        'grant select on table public.%I to authenticated',
        view_name
      );
      execute format(
        'grant select on table public.%I to service_role',
        view_name
      );
    end if;
  end loop;
end
$migration$;

-- 2) Privilégios mínimos necessários às views security_invoker.
-- As tabelas já possuem RLS; SELECT direto continua sujeito às respectivas
-- políticas de linha.
do $migration$
begin
  if to_regclass('public.user_access') is not null then
    grant select on table public.user_access to authenticated, service_role;
  end if;

  if to_regclass('public.usage_events') is not null then
    grant select on table public.usage_events to authenticated, service_role;
  end if;

  if to_regclass('public.user_access_grants') is not null then
    revoke all privileges on table public.user_access_grants from anon;
    revoke insert, update, delete, truncate, references, trigger
      on table public.user_access_grants from authenticated;
    grant select on table public.user_access_grants to authenticated;
    grant select, insert, update, delete
      on table public.user_access_grants to service_role;
  end if;

  if to_regclass('public.organizations') is not null then
    grant select on table public.organizations to authenticated, service_role;
  end if;

  if to_regclass('public.organization_members') is not null then
    grant select on table public.organization_members to authenticated, service_role;
  end if;
end
$migration$;

-- 3) Tabela de auditoria: fechar acesso público e depender exclusivamente de
-- operações server-side com service_role. Não há consumidor autenticado desta
-- tabela no baseline v15.20, portanto nenhuma política permissiva é criada.
do $migration$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'governance_audit_events'
      and c.relkind in ('r', 'p')
  ) then
    alter table public.governance_audit_events enable row level security;

    revoke all privileges on table public.governance_audit_events from anon;
    revoke all privileges on table public.governance_audit_events from authenticated;

    grant select, insert, update, delete
      on table public.governance_audit_events to service_role;
  end if;
end
$migration$;

commit;
