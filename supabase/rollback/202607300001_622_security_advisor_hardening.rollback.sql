-- Rollback funcional controlado — Security Advisor hardening
-- Baseline: Governança v15.20
--
-- Este rollback reverte apenas security_invoker nas três views quando houver
-- incompatibilidade funcional comprovada. Por segurança, ele NÃO reabre acesso
-- anon nem desabilita RLS em governance_audit_events.

begin;

do $rollback$
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
        'alter view public.%I reset (security_invoker)',
        view_name
      );

      execute format(
        'revoke all privileges on table public.%I from anon',
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
$rollback$;

-- Mantém governance_audit_events protegida. service_role continua operando.
do $rollback$
begin
  if to_regclass('public.governance_audit_events') is not null then
    alter table public.governance_audit_events enable row level security;
    revoke all privileges on table public.governance_audit_events from anon;
    revoke all privileges on table public.governance_audit_events from authenticated;
    grant select, insert, update, delete
      on table public.governance_audit_events to service_role;
  end if;
end
$rollback$;

commit;
