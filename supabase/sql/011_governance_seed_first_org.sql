-- =========================================================
-- 011_governance_seed_first_org.sql
-- Publ.IA Governança - Seed manual da primeira organização
-- =========================================================
--
-- Objetivo:
-- Criar manualmente uma organização Governança e vincular
-- um usuário Supabase como owner/admin inicial.
--
-- IMPORTANTE:
-- 1. Troque os valores da seção "CONFIGURAÇÃO MANUAL".
-- 2. Rode este SQL apenas uma vez para cada organização.
-- 3. Este arquivo não altera tabelas existentes do Essencial/Estratégico.
-- 4. Este arquivo depende do SQL 010_governance_foundation.sql.
--
-- =========================================================

do $$
declare
  -- =======================================================
  -- CONFIGURAÇÃO MANUAL
  -- Troque os valores abaixo antes de executar.
  -- =======================================================

  v_user_id uuid := 'COLE_AQUI_O_USER_ID_DO_ADMIN'::uuid;

  v_org_name text := 'Nome do Órgão';
  v_org_legal_name text := 'Nome Jurídico do Órgão';
  v_org_cnpj text := '00000000000000';
  v_org_slug text := 'nome-do-orgao';

  -- Cor principal do Governança para esta organização.
  -- Pode ser ajustada depois.
  v_primary_color text := '#047857';

  -- Limite inicial de assentos/usuários.
  -- Pode deixar null se ainda não quiser limitar.
  v_seats_limit integer := null;

  -- =======================================================
  -- VARIÁVEIS INTERNAS
  -- Não precisa alterar abaixo desta linha.
  -- =======================================================

  v_organization_id uuid;
  v_existing_org_id uuid;
  v_existing_member_id uuid;
begin
  -- Validação simples do user_id
  if v_user_id is null then
    raise exception 'Informe um user_id válido.';
  end if;

  -- Confere se o usuário existe no Supabase Auth
  if not exists (
    select 1
    from auth.users
    where id = v_user_id
  ) then
    raise exception 'Usuário não encontrado em auth.users. Confira o user_id informado.';
  end if;

  -- Confere se já existe organização com o mesmo slug
  select id
    into v_existing_org_id
  from public.organizations
  where slug = v_org_slug
  limit 1;

  if v_existing_org_id is not null then
    v_organization_id := v_existing_org_id;

    update public.organizations
    set
      name = v_org_name,
      legal_name = v_org_legal_name,
      cnpj = v_org_cnpj,
      product_tier = 'governance',
      status = 'active',
      primary_color = v_primary_color,
      seats_limit = v_seats_limit,
      updated_at = now()
    where id = v_organization_id;

    raise notice 'Organização já existia. Dados atualizados. organization_id: %', v_organization_id;
  else
    insert into public.organizations (
      name,
      legal_name,
      cnpj,
      slug,
      product_tier,
      status,
      primary_color,
      seats_limit,
      created_by
    )
    values (
      v_org_name,
      v_org_legal_name,
      v_org_cnpj,
      v_org_slug,
      'governance',
      'active',
      v_primary_color,
      v_seats_limit,
      v_user_id
    )
    returning id into v_organization_id;

    raise notice 'Organização criada com sucesso. organization_id: %', v_organization_id;
  end if;

  -- Confere se o usuário já é membro desta organização
  select id
    into v_existing_member_id
  from public.organization_members
  where organization_id = v_organization_id
    and user_id = v_user_id
  limit 1;

  if v_existing_member_id is not null then
    update public.organization_members
    set
      functional_role = 'administrador',
      technical_role = 'owner',
      status = 'active',
      updated_at = now()
    where id = v_existing_member_id;

    raise notice 'Membro já existia. Permissões atualizadas para owner.';
  else
    insert into public.organization_members (
      organization_id,
      user_id,
      functional_role,
      technical_role,
      status
    )
    values (
      v_organization_id,
      v_user_id,
      'administrador',
      'owner',
      'active'
    );

    raise notice 'Usuário vinculado como owner da organização.';
  end if;

  -- Registra auditoria básica
  insert into public.organization_audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_organization_id,
    v_user_id,
    'organization.seed_first_owner',
    'organization',
    v_organization_id,
    jsonb_build_object(
      'source', '011_governance_seed_first_org.sql',
      'organization_name', v_org_name,
      'organization_slug', v_org_slug,
      'member_role', 'owner'
    )
  );

  raise notice 'Seed concluído com sucesso.';
end $$;