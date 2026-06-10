-- =========================================================
-- 014_update_my_organizations_view_population_region.sql
-- Publ.IA Governança — Atualiza view my_organizations
-- Inclui campos institucionais, população, região e contrato
-- =========================================================

drop view if exists public.my_organizations;

create view public.my_organizations as
select
  o.id,
  o.name,
  o.legal_name,
  o.cnpj,
  o.slug,
  o.organization_type,
  o.municipality_name,
  o.state_uf,
  o.ibge_code,
  o.municipality_size,
  o.population,
  o.region,
  o.product_tier,
  o.status,
  o.primary_color,
  o.logo_url,
  o.contract_reference,
  o.contract_starts_at,
  o.contract_ends_at,
  o.seats_limit,
  o.history_retention_policy,
  om.functional_role,
  om.technical_role,
  om.status as member_status,
  om.joined_at,
  o.created_at,
  o.updated_at
from public.organizations o
join public.organization_members om
  on om.organization_id = o.id
where om.user_id = auth.uid()
  and om.status = 'active';

grant select on public.my_organizations to authenticated;
