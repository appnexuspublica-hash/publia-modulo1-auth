//src/app/api/nexus-admin/organizations/route.ts
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  GovernanceFunctionalRole,
  GovernanceHistoryRetentionPolicy,
  GovernanceMemberStatus,
  GovernanceMunicipalitySize,
  GovernanceOrganizationType,
  GovernanceTechnicalRole,
  OrganizationStatus,
} from "@/types/governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrganizationMemberRow = {
  member_id: string;
  user_id: string;
  cpf: string | null;
  nome: string | null;
  email: string | null;
  functional_role: GovernanceFunctionalRole;
  technical_role: GovernanceTechnicalRole;
  status: GovernanceMemberStatus;
};

type OrganizationOwnerRow = OrganizationMemberRow;

type OrganizationRow = {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string;
  address_logradouro: string | null;
  address_bairro: string | null;
  address_cep: string | null;
  authority_name: string | null;
  authority_position: string | null;
  slug: string;
  organization_type: GovernanceOrganizationType | null;
  municipality_name: string | null;
  state_uf: string | null;
  ibge_code: string | null;
  municipality_size: GovernanceMunicipalitySize | null;
  population: number | null;
  region: string | null;
  product_tier: "governance";
  status: OrganizationStatus;
  primary_color: string;
  logo_url: string | null;
  contract_reference: string | null;
  contract_starts_at: string | null;
  contract_ends_at: string | null;
  seats_limit: number | null;
  history_retention_policy: GovernanceHistoryRetentionPolicy | null;
  created_at: string;
  updated_at: string;
  owner: OrganizationOwnerRow | null;
  members: OrganizationMemberRow[];
  active_owners_count: number;
};

type ProfileRow = {
  user_id: string;
  cpf_cnpj: string | null;
  nome: string | null;
  email: string | null;
};

type CreateBody = {
  organization?: {
    name?: string;
    legalName?: string;
    cnpj?: string;
    addressLogradouro?: string;
    addressBairro?: string;
    addressCep?: string;
    authorityName?: string;
    authorityPosition?: string;
    municipalityName?: string;
    stateUf?: string;
    ibgeCode?: string;
    municipalitySize?: GovernanceMunicipalitySize;
    population?: number | null;
    region?: string;
    contractReference?: string;
    contractStartsAt?: string;
    contractEndsAt?: string;
    historyRetentionPolicy?: GovernanceHistoryRetentionPolicy;
    organizationType?: GovernanceOrganizationType;
    status?: OrganizationStatus;
    seatsLimit?: number | null;
  };
  owner?: {
    nome?: string;
    cpf?: string;
    email?: string;
    password?: string;
    functionalRole?: GovernanceFunctionalRole;
  };
};

type PatchBody = {
  id?: string;
  action?:
    | "update"
    | "set-status"
    | "transfer-owner"
    | "remove-owner"
    | "set-member-status"
    | "update-member"
    | "reset-member-password"
    | "remove-member";
  organization?: Partial<{
    name: string;
    legalName: string;
    cnpj: string;
    addressLogradouro: string;
    addressBairro: string;
    addressCep: string;
    authorityName: string;
    authorityPosition: string;
    municipalityName: string;
    stateUf: string;
    ibgeCode: string;
    municipalitySize: GovernanceMunicipalitySize;
    population: number | null;
    region: string;
    contractReference: string;
    contractStartsAt: string;
    contractEndsAt: string;
    historyRetentionPolicy: GovernanceHistoryRetentionPolicy;
    organizationType: GovernanceOrganizationType;
    status: OrganizationStatus;
    seatsLimit: number | null;
  }>;
  status?: OrganizationStatus | GovernanceMemberStatus;
  memberStatus?: GovernanceMemberStatus;
  member?: {
    nome?: string;
    cpf?: string;
    functionalRole?: GovernanceFunctionalRole;
    technicalRole?: GovernanceTechnicalRole;
  };
  ownerMemberId?: string;
  memberId?: string;
  userId?: string;
  password?: string;
  owner?: {
    nome?: string;
    cpf?: string;
    password?: string;
    functionalRole?: GovernanceFunctionalRole;
  };
};

type DeleteBody = {
  id?: string;
};

const allowedOrganizationTypes: GovernanceOrganizationType[] = [
  "prefeitura",
  "camara_municipal",
  "autarquia",
  "fundacao",
  "consorcio_publico",
  "instituto_previdencia",
  "outro",
];

const allowedMunicipalitySizes: GovernanceMunicipalitySize[] = [
  "small",
  "medium",
  "large",
];

const allowedHistoryRetentionPolicies: GovernanceHistoryRetentionPolicy[] = [
  "contract_duration",
];

const allowedStatuses: OrganizationStatus[] = [
  "implementation",
  "active",
  "inactive",
  "suspended",
  "archived",
];

const allowedFunctionalRoles: GovernanceFunctionalRole[] = [
  "administrador",
  "gestor",
  "controle_interno",
  "juridico",
  "contabilidade",
  "licitacoes",
  "servidor",
  "consultor",
  "outro",
];

const allowedTechnicalRoles: GovernanceTechnicalRole[] = [
  "owner",
  "admin",
  "manager",
  "member",
  "viewer",
];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function makeTechnicalEmailFromCpf(cpf: string) {
  return `cpf.${cpf}@governanca.publia.local`.toLowerCase();
}

function isTechnicalGovernanceEmail(email: string | null | undefined) {
  return Boolean(email?.toLowerCase().endsWith("@governanca.publia.local"));
}

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function isValidOrganizationType(
  value: string,
): value is GovernanceOrganizationType {
  return allowedOrganizationTypes.includes(value as GovernanceOrganizationType);
}

function isValidStatus(value: string): value is OrganizationStatus {
  return allowedStatuses.includes(value as OrganizationStatus);
}

function isValidMunicipalitySize(
  value: string,
): value is GovernanceMunicipalitySize {
  return allowedMunicipalitySizes.includes(value as GovernanceMunicipalitySize);
}

function isValidHistoryRetentionPolicy(
  value: string,
): value is GovernanceHistoryRetentionPolicy {
  return allowedHistoryRetentionPolicies.includes(
    value as GovernanceHistoryRetentionPolicy,
  );
}

function normalizeDateValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizePopulation(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.floor(value);

  return normalized > 0 ? normalized : null;
}

function isValidFunctionalRole(value: string): value is GovernanceFunctionalRole {
  return allowedFunctionalRoles.includes(value as GovernanceFunctionalRole);
}

function getNexusCredentials(request: Request) {
  const expectedUser = process.env.NEXUS_ADMIN_USER || "nexus-admin";
  const expectedPassword = process.env.NEXUS_ADMIN_PASSWORD || "15798296";

  const headerUser = request.headers.get("x-nexus-admin-user") || "";
  const headerPassword = request.headers.get("x-nexus-admin-password") || "";

  return {
    isValid: headerUser === expectedUser && headerPassword === expectedPassword,
  };
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Acesso Nexus Admin não autorizado." },
    { status: 401 },
  );
}

function isIgnorableOptionalDeleteError(error: { code?: string; message?: string } | null) {
  if (!error) return false;

  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("não existe") ||
    message.includes("could not find the table") ||
    message.includes("column") ||
    message.includes("coluna")
  );
}

async function deleteOrganizationScopedRows(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  table: string;
  organizationId: string;
  required?: boolean;
}) {
  const { admin, table, organizationId, required = false } = params;

  const { error } = await admin
    .from(table)
    .delete()
    .eq("organization_id", organizationId);

  if (error && !(isIgnorableOptionalDeleteError(error) && !required)) {
    console.error(
      `[nexus-admin/organizations] Erro ao excluir dados de ${table}:`,
      error,
    );

    throw new Error(
      `Não foi possível excluir registros relacionados em ${table}.`,
    );
  }
}

async function ensureUniqueSlug(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  baseSlug: string;
  ignoreOrganizationId?: string;
}) {
  const { admin, baseSlug, ignoreOrganizationId } = params;

  const safeBase = baseSlug || "organizacao";
  let slug = safeBase;

  for (let index = 0; index < 50; index += 1) {
    const { data, error } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new Error("Não foi possível validar o slug da organização.");
    }

    if (!data || data.id === ignoreOrganizationId) {
      return slug;
    }

    slug = `${safeBase}-${index + 2}`;
  }

  throw new Error("Não foi possível gerar um slug único para a organização.");
}

async function findAuthUserIdByEmail(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  email: string;
}) {
  const { admin, email } = params;

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    console.error("[nexus-admin/organizations] Erro ao listar Auth users:", error);
    return null;
  }

  return (
    data.users.find(
      (authUser) => authUser.email?.toLowerCase() === email.toLowerCase(),
    )?.id ?? null
  );
}

async function ensureProfile(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  cpf: string;
  nome: string;
  technicalEmail: string;
  municipalityName: string;
  stateUf: string;
}) {
  const { admin, userId, cpf, nome, technicalEmail, municipalityName, stateUf } =
    params;

  const cidadeUf =
    municipalityName && stateUf ? `${municipalityName}/${stateUf}` : "";

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("user_id, cpf_cnpj, nome, email")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  if (existingProfileError) {
    console.error(
      "[nexus-admin/organizations] Erro ao verificar profile:",
      existingProfileError,
    );
    throw new Error("Não foi possível verificar o perfil do Owner.");
  }

  if (existingProfile) {
    const { error: updateProfileError } = await admin
      .from("profiles")
      .update({
        cpf_cnpj: existingProfile.cpf_cnpj || cpf,
        nome: existingProfile.nome || nome,
        email: existingProfile.email || technicalEmail,
        cidade_uf: cidadeUf,
        municipio: municipalityName || null,
        uf: stateUf || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateProfileError) {
      console.error(
        "[nexus-admin/organizations] Erro ao atualizar profile:",
        updateProfileError,
      );
      throw new Error("Não foi possível atualizar o perfil do Owner.");
    }

    return;
  }

  const { error: insertProfileError } = await admin.from("profiles").insert({
    user_id: userId,
    cpf_cnpj: cpf,
    nome,
    email: technicalEmail,
    cidade_uf: cidadeUf,
    telefone: "",
    municipio: municipalityName || null,
    uf: stateUf || null,
  });

  if (insertProfileError) {
    console.error(
      "[nexus-admin/organizations] Erro ao criar profile:",
      insertProfileError,
    );
    throw new Error("Owner criado no Auth, mas não foi possível criar o perfil.");
  }
}


async function buildOrganizationsWithOwners(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  organizations: Omit<OrganizationRow, "owner" | "members" | "active_owners_count">[];
}): Promise<OrganizationRow[]> {
  const { admin, organizations } = params;

  if (organizations.length === 0) {
    return [];
  }

  const organizationIds = organizations.map((organization) => organization.id);

  const { data: organizationMemberships, error: organizationMembershipsError } =
    await admin
      .from("organization_members")
      .select(
        `
          id,
          organization_id,
          user_id,
          functional_role,
          technical_role,
          status
        `,
      )
      .in("organization_id", organizationIds)
      .neq("status", "removed")
      .order("technical_role", { ascending: true })
      .order("created_at", { ascending: true });

  if (organizationMembershipsError) {
    console.error(
      "[nexus-admin/organizations] Erro ao buscar membros:",
      organizationMembershipsError,
    );

    throw new Error("Não foi possível buscar os usuários das organizações.");
  }

  const memberships = (organizationMemberships ?? []) as Array<{
    id: string;
    organization_id: string;
    user_id: string;
    functional_role: GovernanceFunctionalRole;
    technical_role: GovernanceTechnicalRole;
    status: GovernanceMemberStatus;
  }>;

  const userIds = Array.from(new Set(memberships.map((item) => item.user_id)));

  const profilesByUserId = new Map<string, ProfileRow>();
  const authEmailsByUserId = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("user_id, cpf_cnpj, nome, email")
      .in("user_id", userIds);

    if (profilesError) {
      console.error(
        "[nexus-admin/organizations] Erro ao buscar perfis dos membros:",
        profilesError,
      );

      throw new Error("Não foi possível buscar os perfis dos usuários.");
    }

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      profilesByUserId.set(profile.user_id, profile);
    }

    const { data: authUsersData, error: authUsersError } =
      await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authUsersError) {
      console.error(
        "[nexus-admin/organizations] Erro ao buscar Auth users dos membros:",
        authUsersError,
      );
    } else {
      for (const authUser of authUsersData.users) {
        if (authUser.id && authUser.email && userIds.includes(authUser.id)) {
          authEmailsByUserId.set(authUser.id, authUser.email);
        }
      }
    }
  }

  return organizations.map((organization) => {
    const organizationMemberships = memberships.filter(
      (membership) => membership.organization_id === organization.id,
    );

    const members = organizationMemberships.map((membership) => {
      const profile = profilesByUserId.get(membership.user_id);

      return {
        member_id: membership.id,
        user_id: membership.user_id,
        cpf: profile?.cpf_cnpj ?? null,
        nome: profile?.nome ?? null,
        email:
          !isTechnicalGovernanceEmail(profile?.email)
            ? profile?.email ?? null
            : !isTechnicalGovernanceEmail(authEmailsByUserId.get(membership.user_id))
              ? authEmailsByUserId.get(membership.user_id) ?? null
              : null,
        functional_role: membership.functional_role,
        technical_role: membership.technical_role,
        status: membership.status,
      };
    });

    const organizationOwners = members.filter(
      (member) =>
        member.technical_role === "owner" && member.status === "active",
    );

    const firstOwner = organizationOwners[0] ?? null;

    return {
      ...organization,
      owner: firstOwner,
      members,
      active_owners_count: organizationOwners.length,
    };
  });
}

async function ensureGovernanceOwnerUser(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  organization: {
    id: string;
    cnpj: string;
    municipality_name: string | null;
    state_uf: string | null;
  };
  cpf: string;
  nome: string;
  password: string;
}) {
  const { admin, organization, cpf, nome, password } = params;
  const technicalEmail = makeTechnicalEmailFromCpf(cpf);

  const { data: existingProfileByCpf, error: existingProfileByCpfError } =
    await admin
      .from("profiles")
      .select("user_id, cpf_cnpj, nome, email")
      .eq("cpf_cnpj", cpf)
      .maybeSingle<ProfileRow>();

  if (existingProfileByCpfError) {
    console.error(
      "[nexus-admin/organizations] Erro ao buscar profile do novo Owner:",
      existingProfileByCpfError,
    );

    throw new Error("Não foi possível verificar se o CPF do novo Owner já existe.");
  }

  let userId = existingProfileByCpf?.user_id ?? null;

  if (!userId) {
    const existingAuthUserId = await findAuthUserIdByEmail({
      admin,
      email: technicalEmail,
    });

    if (existingAuthUserId) {
      userId = existingAuthUserId;
    }
  }

  if (!userId) {
    if (!nome) {
      throw new Error("Informe o nome do novo Owner.");
    }

    if (password.length < 6) {
      throw new Error(
        "Informe uma senha inicial com pelo menos 6 caracteres para criar o novo Owner.",
      );
    }

    const { data: createdAuthUser, error: createAuthUserError } =
      await admin.auth.admin.createUser({
        email: technicalEmail,
        password,
        email_confirm: true,
        user_metadata: {
          nome,
          cpf_cnpj: cpf,
          source: "publia_nexus_admin_transfer_owner",
          organization_id: organization.id,
          organization_cnpj: organization.cnpj,
        },
      });

    if (createAuthUserError || !createdAuthUser.user) {
      console.error(
        "[nexus-admin/organizations] Erro ao criar novo Owner no Auth:",
        createAuthUserError,
      );

      throw new Error(
        createAuthUserError?.message ??
          "Não foi possível criar o novo Owner no Supabase Auth.",
      );
    }

    userId = createdAuthUser.user.id;
  }

  await ensureProfile({
    admin,
    userId,
    cpf,
    nome: nome || existingProfileByCpf?.nome || "Owner",
    technicalEmail,
    municipalityName: organization.municipality_name ?? "",
    stateUf: organization.state_uf ?? "",
  });

  return {
    userId,
    technicalEmail,
  };
}

export async function GET(request: Request) {
  try {
    if (!getNexusCredentials(request).isValid) {
      return unauthorized();
    }

    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("organizations")
      .select(
        `
          id,
          name,
          legal_name,
          cnpj,
          address_logradouro,
          address_bairro,
          address_cep,
          authority_name,
          authority_position,
          slug,
          organization_type,
          municipality_name,
          state_uf,
          ibge_code,
          municipality_size,
          population,
          region,
          product_tier,
          status,
          primary_color,
          logo_url,
          contract_reference,
          contract_starts_at,
          contract_ends_at,
          seats_limit,
          history_retention_policy,
          created_at,
          updated_at
        `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[nexus-admin/organizations] Erro ao listar:", error);

      return NextResponse.json(
        { ok: false, error: "Não foi possível listar organizações." },
        { status: 500 },
      );
    }

    const organizations = await buildOrganizationsWithOwners({
      admin,
      organizations: (data ?? []) as Omit<
        OrganizationRow,
        "owner" | "members" | "active_owners_count"
      >[],
    });

    return NextResponse.json({
      ok: true,
      organizations,
    });
  } catch (error) {
    console.error("[nexus-admin/organizations] GET inesperado:", error);

    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao listar organizações." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!getNexusCredentials(request).isValid) {
      return unauthorized();
    }

    const body = (await request.json().catch(() => null)) as CreateBody | null;

    const organization = body?.organization;
    const owner = body?.owner;

    const name = normalizeText(organization?.name);
    const legalName = normalizeText(organization?.legalName) || null;
    const cnpj = onlyDigits(normalizeText(organization?.cnpj));
    const addressLogradouro = normalizeText(organization?.addressLogradouro) || null;
    const addressBairro = normalizeText(organization?.addressBairro) || null;
    const addressCep = onlyDigits(normalizeText(organization?.addressCep)) || null;
    const authorityName = normalizeText(organization?.authorityName) || null;
    const authorityPosition = normalizeText(organization?.authorityPosition) || null;
    const municipalityName = normalizeText(organization?.municipalityName);
    const stateUf = normalizeText(organization?.stateUf).toUpperCase().slice(0, 2);
    const ibgeCode = onlyDigits(normalizeText(organization?.ibgeCode)) || null;
    const municipalitySize =
      typeof organization?.municipalitySize === "string" &&
      isValidMunicipalitySize(organization.municipalitySize)
        ? organization.municipalitySize
        : "small";
    const population = normalizePopulation(organization?.population);
    const region = normalizeText(organization?.region) || null;
    const contractReference =
      normalizeText(organization?.contractReference) || null;
    const contractStartsAt = normalizeDateValue(organization?.contractStartsAt);
    const contractEndsAt = normalizeDateValue(organization?.contractEndsAt);
    const historyRetentionPolicy =
      typeof organization?.historyRetentionPolicy === "string" &&
      isValidHistoryRetentionPolicy(organization.historyRetentionPolicy)
        ? organization.historyRetentionPolicy
        : "contract_duration";
    const organizationType =
      typeof organization?.organizationType === "string" &&
      isValidOrganizationType(organization.organizationType)
        ? organization.organizationType
        : "prefeitura";
    const status =
      typeof organization?.status === "string" && isValidStatus(organization.status)
        ? organization.status
        : "implementation";
    const seatsLimit =
      typeof organization?.seatsLimit === "number" &&
      Number.isFinite(organization.seatsLimit) &&
      organization.seatsLimit > 0
        ? Math.floor(organization.seatsLimit)
        : null;

    const ownerCpf = onlyDigits(normalizeText(owner?.cpf));
    const ownerNome = normalizeText(owner?.nome);
    const ownerEmail = normalizeText(owner?.email).toLowerCase();
    const ownerPassword = normalizeText(owner?.password);
    const ownerFunctionalRole =
      typeof owner?.functionalRole === "string" &&
      isValidFunctionalRole(owner.functionalRole)
        ? owner.functionalRole
        : "administrador";

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Informe o nome da organização." },
        { status: 400 },
      );
    }

    if (cnpj.length !== 14) {
      return NextResponse.json(
        { ok: false, error: "Informe um CNPJ válido com 14 dígitos." },
        { status: 400 },
      );
    }

    if (!municipalityName) {
      return NextResponse.json(
        { ok: false, error: "Informe o município da organização." },
        { status: 400 },
      );
    }

    if (stateUf.length !== 2) {
      return NextResponse.json(
        { ok: false, error: "Informe a UF com 2 letras." },
        { status: 400 },
      );
    }

    if (ownerCpf.length !== 11) {
      return NextResponse.json(
        { ok: false, error: "Informe o CPF do Owner com 11 dígitos." },
        { status: 400 },
      );
    }

    if (!ownerNome) {
      return NextResponse.json(
        { ok: false, error: "Informe o nome do Owner inicial." },
        { status: 400 },
      );
    }

    if (!isValidEmail(ownerEmail)) {
      return NextResponse.json(
        { ok: false, error: "Informe um e-mail válido para o Owner inicial." },
        { status: 400 },
      );
    }

    if (ownerPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: "A senha inicial do Owner deve ter pelo menos 6 caracteres." },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: existingOrganization, error: existingOrganizationError } =
      await admin
        .from("organizations")
        .select("id")
        .eq("cnpj", cnpj)
        .maybeSingle<{ id: string }>();

    if (existingOrganizationError) {
      console.error(
        "[nexus-admin/organizations] Erro ao verificar CNPJ:",
        existingOrganizationError,
      );

      return NextResponse.json(
        { ok: false, error: "Não foi possível verificar o CNPJ." },
        { status: 500 },
      );
    }

    if (existingOrganization) {
      return NextResponse.json(
        { ok: false, error: "Já existe uma organização com este CNPJ." },
        { status: 409 },
      );
    }

    const slug = await ensureUniqueSlug({
      admin,
      baseSlug: makeSlug(`${name}-${cnpj.slice(-4)}`),
    });

    const { data: createdOrganization, error: createOrganizationError } =
      await admin
        .from("organizations")
        .insert({
          name,
          legal_name: legalName,
          cnpj,
          address_logradouro: addressLogradouro,
          address_bairro: addressBairro,
          address_cep: addressCep,
          authority_name: authorityName,
          authority_position: authorityPosition,
          slug,
          organization_type: organizationType,
          municipality_name: municipalityName,
          state_uf: stateUf,
          ibge_code: ibgeCode,
          municipality_size: municipalitySize,
          population,
          region,
          contract_reference: contractReference,
          contract_starts_at: contractStartsAt,
          contract_ends_at: contractEndsAt,
          history_retention_policy: historyRetentionPolicy,
          product_tier: "governance",
          status,
          primary_color: "#0f3a4a",
          seats_limit: seatsLimit,
        })
        .select(
          `
            id,
            name,
            legal_name,
            cnpj,
            address_logradouro,
            address_bairro,
            address_cep,
            authority_name,
            authority_position,
            slug,
            organization_type,
            municipality_name,
            state_uf,
            ibge_code,
            municipality_size,
            population,
            region,
            product_tier,
            status,
            primary_color,
            logo_url,
            contract_reference,
            contract_starts_at,
            contract_ends_at,
            seats_limit,
            history_retention_policy,
            created_at,
            updated_at
          `,
        )
        .single<OrganizationRow>();

    if (createOrganizationError || !createdOrganization) {
      console.error(
        "[nexus-admin/organizations] Erro ao criar organização:",
        createOrganizationError,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            createOrganizationError?.message ??
            "Não foi possível criar a organização.",
        },
        { status: 500 },
      );
    }

    const technicalEmail = ownerEmail;

    const { data: existingProfileByCpf, error: existingProfileByCpfError } =
      await admin
        .from("profiles")
        .select("user_id, cpf_cnpj, nome, email")
        .eq("cpf_cnpj", ownerCpf)
        .maybeSingle<ProfileRow>();

    if (existingProfileByCpfError) {
      console.error(
        "[nexus-admin/organizations] Erro ao buscar profile por CPF:",
        existingProfileByCpfError,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "Organização criada, mas não foi possível verificar se o CPF do Owner já existe.",
          organization: createdOrganization,
        },
        { status: 500 },
      );
    }

    let ownerUserId: string;

    if (existingProfileByCpf?.user_id) {
      ownerUserId = existingProfileByCpf.user_id;
    } else {
      const existingAuthUserId = await findAuthUserIdByEmail({
        admin,
        email: technicalEmail,
      });

      if (existingAuthUserId) {
        ownerUserId = existingAuthUserId;
      } else {
        const { data: createdAuthUser, error: createAuthUserError } =
          await admin.auth.admin.createUser({
            email: technicalEmail,
            password: ownerPassword,
            email_confirm: true,
            user_metadata: {
              nome: ownerNome,
              cpf_cnpj: ownerCpf,
              source: "publia_nexus_admin",
              organization_id: createdOrganization.id,
              organization_cnpj: createdOrganization.cnpj,
            },
          });

        if (createAuthUserError || !createdAuthUser.user) {
          console.error(
            "[nexus-admin/organizations] Erro ao criar Owner no Auth:",
            createAuthUserError,
          );

          return NextResponse.json(
            {
              ok: false,
              error:
                createAuthUserError?.message ??
                "Organização criada, mas não foi possível criar o Owner no Auth.",
              organization: createdOrganization,
            },
            { status: 500 },
          );
        }

        ownerUserId = createdAuthUser.user.id;
      }
    }

    try {
      await ensureProfile({
        admin,
        userId: ownerUserId,
        cpf: ownerCpf,
        nome: ownerNome,
        technicalEmail,
        municipalityName,
        stateUf,
      });
    } catch (profileError) {
      const message =
        profileError instanceof Error
          ? profileError.message
          : "Organização criada, mas não foi possível criar o perfil do Owner.";

      return NextResponse.json(
        { ok: false, error: message, organization: createdOrganization },
        { status: 500 },
      );
    }

    const { data: existingMembership, error: existingMembershipError } =
      await admin
        .from("organization_members")
        .select("id, status")
        .eq("organization_id", createdOrganization.id)
        .eq("user_id", ownerUserId)
        .maybeSingle<{ id: string; status: GovernanceMemberStatus }>();

    if (existingMembershipError) {
      console.error(
        "[nexus-admin/organizations] Erro ao verificar membership:",
        existingMembershipError,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "Organização e Owner criados, mas não foi possível verificar o vínculo.",
          organization: createdOrganization,
        },
        { status: 500 },
      );
    }

    if (existingMembership?.id) {
      const { error: updateMembershipError } = await admin
        .from("organization_members")
        .update({
          functional_role: ownerFunctionalRole,
          technical_role: "owner" satisfies GovernanceTechnicalRole,
          status: "active" satisfies GovernanceMemberStatus,
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMembership.id);

      if (updateMembershipError) {
        console.error(
          "[nexus-admin/organizations] Erro ao atualizar membership:",
          updateMembershipError,
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "Organização e Owner criados, mas não foi possível ativar o vínculo Owner.",
            organization: createdOrganization,
          },
          { status: 500 },
        );
      }
    } else {
      const { error: insertMembershipError } = await admin
        .from("organization_members")
        .insert({
          organization_id: createdOrganization.id,
          user_id: ownerUserId,
          functional_role: ownerFunctionalRole,
          technical_role: "owner" satisfies GovernanceTechnicalRole,
          status: "active" satisfies GovernanceMemberStatus,
          invited_by: ownerUserId,
          joined_at: new Date().toISOString(),
        });

      if (insertMembershipError) {
        console.error(
          "[nexus-admin/organizations] Erro ao criar membership:",
          insertMembershipError,
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "Organização e Owner criados, mas não foi possível vincular o Owner ao órgão.",
            organization: createdOrganization,
          },
          { status: 500 },
        );
      }
    }

    await admin.from("organization_audit_logs").insert({
      organization_id: createdOrganization.id,
      actor_user_id: ownerUserId,
      action: "organization.created_by_nexus_admin",
      entity_type: "organization",
      entity_id: createdOrganization.id,
      metadata: {
        source: "api/nexus-admin/organizations",
        owner_user_id: ownerUserId,
        owner_cpf: ownerCpf,
        owner_nome: ownerNome,
        owner_functional_role: ownerFunctionalRole,
      },
    });

    return NextResponse.json({
      ok: true,
      organization: createdOrganization,
      owner: {
        user_id: ownerUserId,
        cpf: ownerCpf,
        nome: ownerNome,
        email: technicalEmail,
        functional_role: ownerFunctionalRole,
        technical_role: "owner",
        status: "active",
      },
    });
  } catch (error) {
    console.error("[nexus-admin/organizations] POST inesperado:", error);

    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao cadastrar organização." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!getNexusCredentials(request).isValid) {
      return unauthorized();
    }

    const body = (await request.json().catch(() => null)) as PatchBody | null;
    const id = normalizeText(body?.id);

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Informe a organização." },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();

    if (body?.action === "transfer-owner") {
      const ownerCpf = onlyDigits(normalizeText(body.owner?.cpf));
      const ownerNome = normalizeText(body.owner?.nome);
      const ownerPassword = normalizeText(body.owner?.password);
      const ownerFunctionalRole =
        typeof body.owner?.functionalRole === "string" &&
        isValidFunctionalRole(body.owner.functionalRole)
          ? body.owner.functionalRole
          : "administrador";

      if (ownerCpf.length !== 11) {
        return NextResponse.json(
          { ok: false, error: "Informe o CPF do novo Owner com 11 dígitos." },
          { status: 400 },
        );
      }

      const { data: organization, error: organizationError } = await admin
        .from("organizations")
        .select("id, cnpj, municipality_name, state_uf")
        .eq("id", id)
        .maybeSingle<{
          id: string;
          cnpj: string;
          municipality_name: string | null;
          state_uf: string | null;
        }>();

      if (organizationError || !organization) {
        console.error(
          "[nexus-admin/organizations] Erro ao localizar organização para transferir Owner:",
          organizationError,
        );

        return NextResponse.json(
          { ok: false, error: "Organização não encontrada." },
          { status: 404 },
        );
      }

      let ensuredOwner: { userId: string; technicalEmail: string };

      try {
        ensuredOwner = await ensureGovernanceOwnerUser({
          admin,
          organization,
          cpf: ownerCpf,
          nome: ownerNome,
          password: ownerPassword,
        });
      } catch (ownerError) {
        const message =
          ownerError instanceof Error
            ? ownerError.message
            : "Não foi possível preparar o novo Owner.";

        return NextResponse.json({ ok: false, error: message }, { status: 400 });
      }

      const { data: existingMembership, error: existingMembershipError } =
        await admin
          .from("organization_members")
          .select("id")
          .eq("organization_id", id)
          .eq("user_id", ensuredOwner.userId)
          .maybeSingle<{ id: string }>();

      if (existingMembershipError) {
        console.error(
          "[nexus-admin/organizations] Erro ao verificar vínculo do novo Owner:",
          existingMembershipError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível verificar o vínculo do novo Owner." },
          { status: 500 },
        );
      }

      if (existingMembership?.id) {
        const { error: updateNewOwnerError } = await admin
          .from("organization_members")
          .update({
            functional_role: ownerFunctionalRole,
            technical_role: "owner" satisfies GovernanceTechnicalRole,
            status: "active" satisfies GovernanceMemberStatus,
            joined_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingMembership.id)
          .eq("organization_id", id);

        if (updateNewOwnerError) {
          console.error(
            "[nexus-admin/organizations] Erro ao promover novo Owner:",
            updateNewOwnerError,
          );

          return NextResponse.json(
            { ok: false, error: "Não foi possível promover o novo Owner." },
            { status: 500 },
          );
        }
      } else {
        const { error: insertNewOwnerError } = await admin
          .from("organization_members")
          .insert({
            organization_id: id,
            user_id: ensuredOwner.userId,
            functional_role: ownerFunctionalRole,
            technical_role: "owner" satisfies GovernanceTechnicalRole,
            status: "active" satisfies GovernanceMemberStatus,
            invited_by: ensuredOwner.userId,
            joined_at: new Date().toISOString(),
          });

        if (insertNewOwnerError) {
          console.error(
            "[nexus-admin/organizations] Erro ao vincular novo Owner:",
            insertNewOwnerError,
          );

          return NextResponse.json(
            { ok: false, error: "Não foi possível vincular o novo Owner." },
            { status: 500 },
          );
        }
      }

      const { error: demoteOldOwnersError } = await admin
        .from("organization_members")
        .update({
          technical_role: "admin" satisfies GovernanceTechnicalRole,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", id)
        .eq("technical_role", "owner")
        .eq("status", "active")
        .neq("user_id", ensuredOwner.userId);

      if (demoteOldOwnersError) {
        console.error(
          "[nexus-admin/organizations] Erro ao rebaixar Owners anteriores:",
          demoteOldOwnersError,
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "Novo Owner definido, mas não foi possível rebaixar o Owner anterior. Verifique os vínculos.",
          },
          { status: 500 },
        );
      }

      await admin.from("organization_audit_logs").insert({
        organization_id: id,
        actor_user_id: ensuredOwner.userId,
        action: "organization_owner.transferred_by_nexus_admin",
        entity_type: "organization_member",
        entity_id: ensuredOwner.userId,
        metadata: {
          source: "api/nexus-admin/organizations",
          new_owner_user_id: ensuredOwner.userId,
          new_owner_cpf: ownerCpf,
          new_owner_nome: ownerNome,
          new_owner_functional_role: ownerFunctionalRole,
          new_owner_email: ensuredOwner.technicalEmail,
        },
      });

      return NextResponse.json({
        ok: true,
        owner: {
          user_id: ensuredOwner.userId,
          cpf: ownerCpf,
          nome: ownerNome,
          email: ensuredOwner.technicalEmail,
          functional_role: ownerFunctionalRole,
          technical_role: "owner",
          status: "active",
        },
      });
    }

    if (body?.action === "remove-owner") {
      const ownerMemberId = normalizeText(body.ownerMemberId);

      if (!ownerMemberId) {
        return NextResponse.json(
          { ok: false, error: "Informe o vínculo Owner que será removido." },
          { status: 400 },
        );
      }

      const { data: activeOwners, error: activeOwnersError } = await admin
        .from("organization_members")
        .select("id, user_id")
        .eq("organization_id", id)
        .eq("technical_role", "owner")
        .eq("status", "active");

      if (activeOwnersError) {
        console.error(
          "[nexus-admin/organizations] Erro ao contar Owners ativos:",
          activeOwnersError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível verificar os Owners ativos." },
          { status: 500 },
        );
      }

      if ((activeOwners ?? []).length <= 1) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Não é possível remover o único Owner ativo. Transfira a propriedade primeiro.",
          },
          { status: 400 },
        );
      }

      const targetOwner = (activeOwners ?? []).find(
        (owner) => owner.id === ownerMemberId,
      );

      if (!targetOwner) {
        return NextResponse.json(
          { ok: false, error: "Owner ativo não encontrado nesta organização." },
          { status: 404 },
        );
      }

      const { error: removeOwnerError } = await admin
        .from("organization_members")
        .update({
          status: "removed" satisfies GovernanceMemberStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ownerMemberId)
        .eq("organization_id", id);

      if (removeOwnerError) {
        console.error(
          "[nexus-admin/organizations] Erro ao remover vínculo Owner:",
          removeOwnerError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível remover o vínculo Owner." },
          { status: 500 },
        );
      }

      await admin.from("organization_audit_logs").insert({
        organization_id: id,
        actor_user_id: targetOwner.user_id,
        action: "organization_owner.removed_by_nexus_admin",
        entity_type: "organization_member",
        entity_id: ownerMemberId,
        metadata: {
          source: "api/nexus-admin/organizations",
          removed_owner_user_id: targetOwner.user_id,
        },
      });

      return NextResponse.json({ ok: true });
    }

    if (body?.action === "set-member-status") {
      const memberId = normalizeText(body.memberId);
      const rawStatus =
        typeof body.memberStatus === "string"
          ? body.memberStatus
          : typeof body.status === "string"
            ? body.status
            : "";

      const memberStatus =
        rawStatus === "active" || rawStatus === "suspended"
          ? (rawStatus as GovernanceMemberStatus)
          : null;

      if (!memberId) {
        return NextResponse.json(
          { ok: false, error: "Informe o usuário que terá o status alterado." },
          { status: 400 },
        );
      }

      if (!memberStatus) {
        return NextResponse.json(
          { ok: false, error: "Status de usuário inválido." },
          { status: 400 },
        );
      }

      const { data: member, error: memberError } = await admin
        .from("organization_members")
        .select("id, user_id, technical_role, status")
        .eq("id", memberId)
        .eq("organization_id", id)
        .neq("status", "removed")
        .maybeSingle<{
          id: string;
          user_id: string;
          technical_role: GovernanceTechnicalRole;
          status: GovernanceMemberStatus;
        }>();

      if (memberError) {
        console.error(
          "[nexus-admin/organizations] Erro ao localizar membro:",
          memberError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível localizar o usuário." },
          { status: 500 },
        );
      }

      if (!member) {
        return NextResponse.json(
          { ok: false, error: "Usuário não encontrado nesta organização." },
          { status: 404 },
        );
      }

      if (
       memberStatus === "suspended" &&
        member.technical_role === "owner" &&
        member.status === "active"
      ) {
        const { data: activeOwners, error: activeOwnersError } = await admin
          .from("organization_members")
          .select("id")
          .eq("organization_id", id)
          .eq("technical_role", "owner")
          .eq("status", "active");

        if (activeOwnersError) {
          console.error(
            "[nexus-admin/organizations] Erro ao contar Owners ativos:",
            activeOwnersError,
          );

          return NextResponse.json(
            { ok: false, error: "Não foi possível verificar os Owners ativos." },
            { status: 500 },
          );
        }

        if ((activeOwners ?? []).length <= 1) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Não é possível suspender/bloquear o único Owner ativo. Transfira a propriedade primeiro.",
            },
            { status: 400 },
          );
        }
      }

      const { error: updateMemberError } = await admin
        .from("organization_members")
        .update({
          status: memberStatus,
          updated_at: new Date().toISOString(),
          ...(memberStatus === "active"
            ? { joined_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", memberId)
        .eq("organization_id", id);

      if (updateMemberError) {
        console.error(
          "[nexus-admin/organizations] Erro ao alterar status do membro:",
          updateMemberError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível alterar o status do usuário." },
          { status: 500 },
        );
      }

      await admin.from("organization_audit_logs").insert({
        organization_id: id,
        actor_user_id: member.user_id,
        action:
          memberStatus === "active"
            ? "organization_member.reactivated_by_nexus_admin"
            : "organization_member.suspended_by_nexus_admin",
        entity_type: "organization_member",
        entity_id: memberId,
        metadata: {
          source: "api/nexus-admin/organizations",
          target_user_id: member.user_id,
          previous_status: member.status,
          next_status: memberStatus,
        },
      });

      return NextResponse.json({ ok: true });
    }


    if (body?.action === "update-member") {
      const memberId = normalizeText(body.memberId);
      const member = body.member;

      if (!memberId) {
        return NextResponse.json(
          { ok: false, error: "Informe o usuário que será editado." },
          { status: 400 },
        );
      }

      const nome = normalizeText(member?.nome);
      const cpf = onlyDigits(normalizeText(member?.cpf));
      const hasCpfInPayload = typeof member?.cpf === "string";
      const functionalRole =
        typeof member?.functionalRole === "string" &&
        isValidFunctionalRole(member.functionalRole)
          ? member.functionalRole
          : null;
      const technicalRole =
        typeof member?.technicalRole === "string" &&
        allowedTechnicalRoles.includes(member.technicalRole)
          ? member.technicalRole
          : null;

      if (!nome) {
        return NextResponse.json(
          { ok: false, error: "Informe o nome do usuário." },
          { status: 400 },
        );
      }

      if (hasCpfInPayload && cpf.length !== 11) {
        return NextResponse.json(
          { ok: false, error: "Informe um CPF válido com 11 dígitos." },
          { status: 400 },
        );
      }

      if (!functionalRole) {
        return NextResponse.json(
          { ok: false, error: "Perfil funcional inválido." },
          { status: 400 },
        );
      }

      if (!technicalRole) {
        return NextResponse.json(
          { ok: false, error: "Papel técnico inválido." },
          { status: 400 },
        );
      }

      const { data: currentMember, error: currentMemberError } = await admin
        .from("organization_members")
        .select("id, user_id, technical_role, status")
        .eq("id", memberId)
        .eq("organization_id", id)
        .neq("status", "removed")
        .maybeSingle<{
          id: string;
          user_id: string;
          technical_role: GovernanceTechnicalRole;
          status: GovernanceMemberStatus;
        }>();

      if (currentMemberError) {
        console.error(
          "[nexus-admin/organizations] Erro ao localizar membro para edição:",
          currentMemberError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível localizar o usuário." },
          { status: 500 },
        );
      }

      if (!currentMember) {
        return NextResponse.json(
          { ok: false, error: "Usuário não encontrado nesta organização." },
          { status: 404 },
        );
      }

      if (currentMember.technical_role === "owner" && technicalRole !== "owner") {
        const { data: activeOwners, error: activeOwnersError } = await admin
          .from("organization_members")
          .select("id")
          .eq("organization_id", id)
          .eq("technical_role", "owner")
          .eq("status", "active");

        if (activeOwnersError) {
          console.error(
            "[nexus-admin/organizations] Erro ao contar Owners ativos:",
            activeOwnersError,
          );

          return NextResponse.json(
            { ok: false, error: "Não foi possível verificar os Owners ativos." },
            { status: 500 },
          );
        }

        if ((activeOwners ?? []).length <= 1 && currentMember.status === "active") {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Não é possível remover o papel Owner do único Owner ativo. Transfira a propriedade primeiro.",
            },
            { status: 400 },
          );
        }
      }

      const profileUpdates: Record<string, unknown> = {
        nome,
        updated_at: new Date().toISOString(),
      };

      if (hasCpfInPayload) {
        profileUpdates.cpf_cnpj = cpf;
      }

      const { error: updateProfileError } = await admin
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", currentMember.user_id);

      if (updateProfileError) {
        console.error(
          "[nexus-admin/organizations] Erro ao atualizar profile do membro:",
          updateProfileError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível atualizar o perfil do usuário." },
          { status: 500 },
        );
      }

      const { error: updateMemberError } = await admin
        .from("organization_members")
        .update({
          functional_role: functionalRole,
          technical_role: technicalRole,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId)
        .eq("organization_id", id);

      if (updateMemberError) {
        console.error(
          "[nexus-admin/organizations] Erro ao atualizar vínculo do membro:",
          updateMemberError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível atualizar o vínculo do usuário." },
          { status: 500 },
        );
      }

      await admin.from("organization_audit_logs").insert({
        organization_id: id,
        actor_user_id: currentMember.user_id,
        action: "organization_member.updated_by_nexus_admin",
        entity_type: "organization_member",
        entity_id: memberId,
        metadata: {
          source: "api/nexus-admin/organizations",
          target_user_id: currentMember.user_id,
          nome,
          ...(hasCpfInPayload ? { cpf } : {}),
          functional_role: functionalRole,
          technical_role: technicalRole,
        },
      });

      return NextResponse.json({ ok: true });
    }

    if (body?.action === "reset-member-password") {
      const memberId = normalizeText(body.memberId);
      const password = normalizeText(body.password);

      if (!memberId) {
        return NextResponse.json(
          { ok: false, error: "Informe o usuário que terá a senha redefinida." },
          { status: 400 },
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { ok: false, error: "A nova senha deve ter pelo menos 6 caracteres." },
          { status: 400 },
        );
      }

      const { data: member, error: memberError } = await admin
        .from("organization_members")
        .select("id, user_id")
        .eq("id", memberId)
        .eq("organization_id", id)
        .neq("status", "removed")
        .maybeSingle<{
          id: string;
          user_id: string;
        }>();

      if (memberError) {
        console.error(
          "[nexus-admin/organizations] Erro ao localizar membro para redefinir senha:",
          memberError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível localizar o usuário." },
          { status: 500 },
        );
      }

      if (!member) {
        return NextResponse.json(
          { ok: false, error: "Usuário não encontrado nesta organização." },
          { status: 404 },
        );
      }

      const { error: passwordError } = await admin.auth.admin.updateUserById(
        member.user_id,
        { password },
      );

      if (passwordError) {
        console.error(
          "[nexus-admin/organizations] Erro ao redefinir senha do usuário:",
          passwordError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível redefinir a senha do usuário." },
          { status: 500 },
        );
      }

      await admin.from("organization_audit_logs").insert({
        organization_id: id,
        actor_user_id: member.user_id,
        action: "organization_member.password_reset_by_nexus_admin",
        entity_type: "organization_member",
        entity_id: memberId,
        metadata: {
          source: "api/nexus-admin/organizations",
          target_user_id: member.user_id,
        },
      });

      return NextResponse.json({ ok: true });
    }

    if (body?.action === "remove-member") {
      const memberId = normalizeText(body.memberId);

      if (!memberId) {
        return NextResponse.json(
          { ok: false, error: "Informe o usuário que terá o vínculo excluído." },
          { status: 400 },
        );
      }

      const { data: member, error: memberError } = await admin
        .from("organization_members")
        .select("id, user_id, technical_role, status")
        .eq("id", memberId)
        .eq("organization_id", id)
        .neq("status", "removed")
        .maybeSingle<{
          id: string;
          user_id: string;
          technical_role: GovernanceTechnicalRole;
          status: GovernanceMemberStatus;
        }>();

      if (memberError) {
        console.error(
          "[nexus-admin/organizations] Erro ao localizar membro para remoção:",
          memberError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível localizar o usuário." },
          { status: 500 },
        );
      }

      if (!member) {
        return NextResponse.json(
          { ok: false, error: "Usuário não encontrado nesta organização." },
          { status: 404 },
        );
      }

      if (member.technical_role === "owner" && member.status === "active") {
        const { data: activeOwners, error: activeOwnersError } = await admin
          .from("organization_members")
          .select("id")
          .eq("organization_id", id)
          .eq("technical_role", "owner")
          .eq("status", "active");

        if (activeOwnersError) {
          console.error(
            "[nexus-admin/organizations] Erro ao contar Owners ativos:",
            activeOwnersError,
          );

          return NextResponse.json(
            { ok: false, error: "Não foi possível verificar os Owners ativos." },
            { status: 500 },
          );
        }

        if ((activeOwners ?? []).length <= 1) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Não é possível excluir o único Owner ativo. Transfira a propriedade primeiro.",
            },
            { status: 400 },
          );
        }
      }

      const { error: removeMemberError } = await admin
        .from("organization_members")
        .update({
          status: "removed" satisfies GovernanceMemberStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId)
        .eq("organization_id", id);

      if (removeMemberError) {
        console.error(
          "[nexus-admin/organizations] Erro ao excluir vínculo do membro:",
          removeMemberError,
        );

        return NextResponse.json(
          { ok: false, error: "Não foi possível excluir o vínculo do usuário." },
          { status: 500 },
        );
      }

      await admin.from("organization_audit_logs").insert({
        organization_id: id,
        actor_user_id: member.user_id,
        action: "organization_member.removed_by_nexus_admin",
        entity_type: "organization_member",
        entity_id: memberId,
        metadata: {
          source: "api/nexus-admin/organizations",
          target_user_id: member.user_id,
          previous_status: member.status,
        },
      });

      return NextResponse.json({ ok: true });
    }

    if (body?.action === "set-status") {
      const status =
        typeof body.status === "string" && isValidStatus(body.status)
          ? body.status
          : null;

      if (!status) {
        return NextResponse.json(
          { ok: false, error: "Status inválido." },
          { status: 400 },
        );
      }

      const { error } = await admin
        .from("organizations")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        console.error("[nexus-admin/organizations] Erro ao alterar status:", error);

        return NextResponse.json(
          { ok: false, error: "Não foi possível alterar o status." },
          { status: 500 },
        );
      }

      return NextResponse.json({ ok: true });
    }

    const organization = body?.organization;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof organization?.name === "string") {
      const name = organization.name.trim();

      if (!name) {
        return NextResponse.json(
          { ok: false, error: "Informe o nome da organização." },
          { status: 400 },
        );
      }

      updates.name = name;
      updates.slug = await ensureUniqueSlug({
        admin,
        baseSlug: makeSlug(name),
        ignoreOrganizationId: id,
      });
    }

    if (typeof organization?.legalName === "string") {
      updates.legal_name = organization.legalName.trim() || null;
    }

    if (typeof organization?.cnpj === "string") {
      const cnpj = onlyDigits(organization.cnpj);

      if (cnpj.length !== 14) {
        return NextResponse.json(
          { ok: false, error: "Informe um CNPJ válido com 14 dígitos." },
          { status: 400 },
        );
      }

      updates.cnpj = cnpj;
    }

    if (typeof organization?.addressLogradouro === "string") {
      updates.address_logradouro = organization.addressLogradouro.trim() || null;
    }

    if (typeof organization?.addressBairro === "string") {
      updates.address_bairro = organization.addressBairro.trim() || null;
    }

    if (typeof organization?.addressCep === "string") {
      updates.address_cep = onlyDigits(organization.addressCep) || null;
    }

    if (typeof organization?.authorityName === "string") {
      updates.authority_name = organization.authorityName.trim() || null;
    }

    if (typeof organization?.authorityPosition === "string") {
      updates.authority_position = organization.authorityPosition.trim() || null;
    }

    if (typeof organization?.municipalityName === "string") {
      updates.municipality_name = organization.municipalityName.trim();
    }

    if (typeof organization?.stateUf === "string") {
      const stateUf = organization.stateUf.trim().toUpperCase();

      if (stateUf.length !== 2) {
        return NextResponse.json(
          { ok: false, error: "Informe a UF com 2 letras." },
          { status: 400 },
        );
      }

      updates.state_uf = stateUf;
    }

    if (typeof organization?.ibgeCode === "string") {
      updates.ibge_code = onlyDigits(organization.ibgeCode) || null;
    }

    if (
      typeof organization?.municipalitySize === "string" &&
      isValidMunicipalitySize(organization.municipalitySize)
    ) {
      updates.municipality_size = organization.municipalitySize;
    }

    if (organization?.population === null) {
      updates.population = null;
    }

    if (
      typeof organization?.population === "number" &&
      Number.isFinite(organization.population)
    ) {
      updates.population = normalizePopulation(organization.population);
    }

    if (typeof organization?.region === "string") {
      updates.region = organization.region.trim() || null;
    }

    if (typeof organization?.contractReference === "string") {
      updates.contract_reference = organization.contractReference.trim() || null;
    }

    if (typeof organization?.contractStartsAt === "string") {
      updates.contract_starts_at = normalizeDateValue(
        organization.contractStartsAt,
      );
    }

    if (typeof organization?.contractEndsAt === "string") {
      updates.contract_ends_at = normalizeDateValue(organization.contractEndsAt);
    }

    if (
      typeof organization?.historyRetentionPolicy === "string" &&
      isValidHistoryRetentionPolicy(organization.historyRetentionPolicy)
    ) {
      updates.history_retention_policy = organization.historyRetentionPolicy;
    }

    if (
      typeof organization?.organizationType === "string" &&
      isValidOrganizationType(organization.organizationType)
    ) {
      updates.organization_type = organization.organizationType;
    }

    if (typeof organization?.status === "string" && isValidStatus(organization.status)) {
      updates.status = organization.status;
    }

    if (organization?.seatsLimit === null) {
      updates.seats_limit = null;
    }

    if (
      typeof organization?.seatsLimit === "number" &&
      Number.isFinite(organization.seatsLimit)
    ) {
      updates.seats_limit =
        organization.seatsLimit > 0 ? Math.floor(organization.seatsLimit) : null;
    }

    const { error } = await admin.from("organizations").update(updates).eq("id", id);

    if (error) {
      console.error("[nexus-admin/organizations] Erro ao atualizar:", error);

      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Não foi possível atualizar a organização.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[nexus-admin/organizations] PATCH inesperado:", error);

    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao atualizar organização." },
      { status: 500 },
    );
  }
}


export async function DELETE(request: Request) {
  try {
    if (!getNexusCredentials(request).isValid) {
      return unauthorized();
    }

    const body = (await request.json().catch(() => null)) as DeleteBody | null;
    const id = normalizeText(body?.id);

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Informe a organização." },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", id)
      .maybeSingle<{ id: string; name: string }>();

    if (organizationError) {
      console.error(
        "[nexus-admin/organizations] Erro ao localizar organização:",
        organizationError,
      );

      return NextResponse.json(
        { ok: false, error: "Não foi possível localizar a organização." },
        { status: 500 },
      );
    }

    if (!organization) {
      return NextResponse.json(
        { ok: false, error: "Organização não encontrada." },
        { status: 404 },
      );
    }

    const optionalOrganizationTables = [
      "governance_pdf_conversation_files",
      "governance_pdf_chunks",
      "governance_pdf_files",
      "pdf_conversation_files",
      "pdf_chunks",
      "pdf_files",
      "conversation_messages",
      "governance_messages",
      "messages",
      "governance_conversations",
      "conversations",
      "institutional_documents",
      "official_sources",
      "organization_audit_logs",
    ];

    for (const table of optionalOrganizationTables) {
      await deleteOrganizationScopedRows({
        admin,
        table,
        organizationId: id,
      });
    }

    await deleteOrganizationScopedRows({
      admin,
      table: "organization_members",
      organizationId: id,
      required: true,
    });

    const { error: deleteOrganizationError } = await admin
      .from("organizations")
      .delete()
      .eq("id", id);

    if (deleteOrganizationError) {
      console.error(
        "[nexus-admin/organizations] Erro ao excluir organização:",
        deleteOrganizationError,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            deleteOrganizationError.message ||
            "Não foi possível excluir a organização. Verifique se há dados vinculados.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      deletedOrganizationId: id,
    });
  } catch (error) {
    console.error("[nexus-admin/organizations] DELETE inesperado:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao excluir organização.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
