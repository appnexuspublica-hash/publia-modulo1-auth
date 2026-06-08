//src/app/api/nexus-admin/organizations/route.ts
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  GovernanceFunctionalRole,
  GovernanceMemberStatus,
  GovernanceOrganizationType,
  GovernanceTechnicalRole,
  OrganizationStatus,
} from "@/types/governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrganizationRow = {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string;
  slug: string;
  organization_type: GovernanceOrganizationType | null;
  municipality_name: string | null;
  state_uf: string | null;
  ibge_code: string | null;
  municipality_size: "small" | "medium" | "large" | null;
  product_tier: "governance";
  status: OrganizationStatus;
  primary_color: string;
  logo_url: string | null;
  contract_reference: string | null;
  contract_starts_at: string | null;
  contract_ends_at: string | null;
  seats_limit: number | null;
  history_retention_policy: "contract_duration" | null;
  created_at: string;
  updated_at: string;
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
    municipalityName?: string;
    stateUf?: string;
    ibgeCode?: string;
    organizationType?: GovernanceOrganizationType;
    status?: OrganizationStatus;
    seatsLimit?: number | null;
  };
  owner?: {
    nome?: string;
    cpf?: string;
    password?: string;
    functionalRole?: GovernanceFunctionalRole;
  };
};

type PatchBody = {
  id?: string;
  action?: "update" | "set-status";
  organization?: Partial<{
    name: string;
    legalName: string;
    cnpj: string;
    municipalityName: string;
    stateUf: string;
    ibgeCode: string;
    organizationType: GovernanceOrganizationType;
    status: OrganizationStatus;
    seatsLimit: number | null;
  }>;
  status?: OrganizationStatus;
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

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function makeTechnicalEmailFromCpf(cpf: string) {
  return `cpf.${cpf}@governanca.publia.local`.toLowerCase();
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
          slug,
          organization_type,
          municipality_name,
          state_uf,
          ibge_code,
          municipality_size,
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

    return NextResponse.json({
      ok: true,
      organizations: (data ?? []) as OrganizationRow[],
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
    const municipalityName = normalizeText(organization?.municipalityName);
    const stateUf = normalizeText(organization?.stateUf).toUpperCase().slice(0, 2);
    const ibgeCode = onlyDigits(normalizeText(organization?.ibgeCode)) || null;
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
          slug,
          organization_type: organizationType,
          municipality_name: municipalityName,
          state_uf: stateUf,
          ibge_code: ibgeCode,
          municipality_size: "small",
          product_tier: "governance",
          status,
          primary_color: "#0f3a4a",
          seats_limit: seatsLimit,
          history_retention_policy: "contract_duration",
        })
        .select(
          `
            id,
            name,
            legal_name,
            cnpj,
            slug,
            organization_type,
            municipality_name,
            state_uf,
            ibge_code,
            municipality_size,
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

    const technicalEmail = makeTechnicalEmailFromCpf(ownerCpf);

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
