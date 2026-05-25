// src/app/api/governance/users/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";
import type {
  GovernanceFunctionalRole,
  GovernanceMemberStatus,
  GovernanceTechnicalRole,
} from "@/types/governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateGovernanceUserBody = {
  cpf?: string;
  nome?: string;
  password?: string;
  functionalRole?: GovernanceFunctionalRole;
  technicalRole?: GovernanceTechnicalRole;
};

type UpdateGovernanceUserBody = {
  memberId?: string;
  functionalRole?: GovernanceFunctionalRole;
  technicalRole?: GovernanceTechnicalRole;
  status?: GovernanceMemberStatus;
};

type DeleteGovernanceUserBody = {
  memberId?: string;
};

type ExistingProfileRow = {
  user_id: string;
  cpf_cnpj: string | null;
  nome: string | null;
  email: string | null;
};

type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  functional_role: GovernanceFunctionalRole;
  technical_role: GovernanceTechnicalRole;
  status: GovernanceMemberStatus;
  joined_at: string | null;
};

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

const allowedPatchStatuses: GovernanceMemberStatus[] = [
  "active",
  "suspended",
];

function createCookieSupabaseClient() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL não configurados.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function makeTechnicalEmailFromCpf(cpf: string) {
  return `cpf.${cpf}@governanca.publia.local`.toLowerCase();
}

function canManageUsers(technicalRole: GovernanceTechnicalRole) {
  return ["owner", "admin"].includes(technicalRole);
}

function isValidFunctionalRole(
  value: string,
): value is GovernanceFunctionalRole {
  return allowedFunctionalRoles.includes(value as GovernanceFunctionalRole);
}

function isValidTechnicalRole(value: string): value is GovernanceTechnicalRole {
  return allowedTechnicalRoles.includes(value as GovernanceTechnicalRole);
}

function isValidPatchStatus(value: string): value is GovernanceMemberStatus {
  return allowedPatchStatuses.includes(value as GovernanceMemberStatus);
}

function getMembershipAction(params: {
  before: OrganizationMemberRow;
  afterStatus?: GovernanceMemberStatus;
  hasRoleChanges: boolean;
}) {
  const { before, afterStatus, hasRoleChanges } = params;

  if (afterStatus === "active" && before.status !== "active") {
    return "organization_member.reactivated";
  }

  if (afterStatus === "suspended" && before.status !== "suspended") {
    return "organization_member.suspended";
  }

  if (hasRoleChanges) {
    return "organization_member.updated";
  }

  return "organization_member.updated";
}

async function findAuthUserIdByEmail(params: {
  admin: ReturnType<typeof createServiceRoleClient>;
  email: string;
}) {
  const { admin, email } = params;

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    console.error("[governance/users] Erro ao listar usuários Auth:", error);

    return null;
  }

  const foundUser = data.users.find(
    (authUser) => authUser.email?.toLowerCase() === email.toLowerCase(),
  );

  return foundUser?.id ?? null;
}

async function ensureProfile(params: {
  admin: ReturnType<typeof createServiceRoleClient>;
  userId: string;
  cpf: string;
  nome: string;
  technicalEmail: string;
  cidadeUf: string | null;
}) {
  const { admin, userId, cpf, nome, technicalEmail, cidadeUf } = params;

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("user_id, cpf_cnpj, nome, email")
    .eq("user_id", userId)
    .maybeSingle<ExistingProfileRow>();

  if (existingProfileError) {
    console.error(
      "[governance/users] Erro ao verificar profile por user_id:",
      existingProfileError,
    );

    throw new Error("Não foi possível verificar o perfil do usuário.");
  }

  if (existingProfile) {
    const { error: updateProfileError } = await admin
      .from("profiles")
      .update({
        cpf_cnpj: existingProfile.cpf_cnpj || cpf,
        nome: existingProfile.nome || nome,
        email: existingProfile.email || technicalEmail,
        cidade_uf: cidadeUf,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateProfileError) {
      console.error(
        "[governance/users] Erro ao atualizar profile existente:",
        updateProfileError,
      );

      throw new Error("Não foi possível atualizar o perfil do usuário.");
    }

    return;
  }

  const { error: insertProfileError } = await admin.from("profiles").insert({
    user_id: userId,
    cpf_cnpj: cpf,
    nome,
    email: technicalEmail,
    telefone: "",
    cidade_uf: cidadeUf,
  });

  if (insertProfileError) {
    console.error(
      "[governance/users] Erro ao criar profile:",
      insertProfileError,
    );

    throw new Error("Usuário criado, mas não foi possível criar o perfil.");
  }
}

async function getAuthenticatedGovernanceContext() {
  const supabase = createCookieSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      ),
      user: null,
      context: null,
    };
  }

  const context = await getCurrentGovernanceOrganization(user.id);

  if (!context) {
    return {
      errorResponse: NextResponse.json(
        { error: "Usuário não vinculado a uma organização ativa." },
        { status: 403 },
      ),
      user: null,
      context: null,
    };
  }

  if (!canManageUsers(context.membership.technical_role)) {
    return {
      errorResponse: NextResponse.json(
        { error: "Você não tem permissão para gerenciar usuários." },
        { status: 403 },
      ),
      user: null,
      context: null,
    };
  }

  return {
    errorResponse: null,
    user,
    context,
  };
}

async function getTargetMembership(params: {
  admin: ReturnType<typeof createServiceRoleClient>;
  organizationId: string;
  memberId: string;
}) {
  const { admin, organizationId, memberId } = params;

  const { data: targetMembership, error: targetMembershipError } = await admin
    .from("organization_members")
    .select(
      "id, organization_id, user_id, functional_role, technical_role, status, joined_at",
    )
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .maybeSingle<OrganizationMemberRow>();

  if (targetMembershipError) {
    console.error(
      "[governance/users] Erro ao buscar vínculo alvo:",
      targetMembershipError,
    );

    throw new Error("Não foi possível localizar o vínculo do usuário.");
  }

  return targetMembership;
}

async function assertCanChangeTarget(params: {
  actorUserId: string;
  actorTechnicalRole: GovernanceTechnicalRole;
  targetMembership: OrganizationMemberRow;
}) {
  const { actorUserId, actorTechnicalRole, targetMembership } = params;

  if (targetMembership.user_id === actorUserId) {
    return NextResponse.json(
      {
        error:
          "Para evitar perda de acesso, seu próprio vínculo não pode ser alterado por aqui.",
      },
      { status: 403 },
    );
  }

  if (
    targetMembership.technical_role === "owner" &&
    actorTechnicalRole !== "owner"
  ) {
    return NextResponse.json(
      { error: "Somente um proprietário pode alterar outro proprietário." },
      { status: 403 },
    );
  }

  return null;
}

async function ensureSeatAvailableForActivation(params: {
  admin: ReturnType<typeof createServiceRoleClient>;
  organizationId: string;
  organizationSeatsLimit: number | null;
  targetMemberId: string;
}) {
  const { admin, organizationId, organizationSeatsLimit, targetMemberId } =
    params;

  if (organizationSeatsLimit === null) {
    return null;
  }

  const { data: activeMembersData, error: activeMembersError } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (activeMembersError) {
    console.error(
      "[governance/users] Erro ao verificar assentos:",
      activeMembersError,
    );

    return NextResponse.json(
      { error: "Não foi possível verificar o limite de assentos." },
      { status: 500 },
    );
  }

  const activeMembersCountExcludingTarget = (activeMembersData ?? []).filter(
    (member) => member.id !== targetMemberId,
  ).length;

  if (activeMembersCountExcludingTarget >= organizationSeatsLimit) {
    return NextResponse.json(
      {
        error:
          "Limite de assentos atingido. Aumente o contrato ou remova/suspenda outro usuário.",
      },
      { status: 409 },
    );
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const authenticated = await getAuthenticatedGovernanceContext();

    if (authenticated.errorResponse || !authenticated.user || !authenticated.context) {
      return authenticated.errorResponse;
    }

    const { user, context } = authenticated;
    const { organization, membership } = context;

    if (!canManageUsers(membership.technical_role)) {
      return NextResponse.json(
        { error: "Você não tem permissão para cadastrar usuários." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | CreateGovernanceUserBody
      | null;

    const cpf = onlyDigits(body?.cpf ?? "");
    const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
    const password =
      typeof body?.password === "string" ? body.password.trim() : "";

    const functionalRole =
      typeof body?.functionalRole === "string" &&
      isValidFunctionalRole(body.functionalRole)
        ? body.functionalRole
        : "servidor";

    const technicalRole =
      typeof body?.technicalRole === "string" &&
      isValidTechnicalRole(body.technicalRole)
        ? body.technicalRole
        : "member";

    if (technicalRole === "owner" && membership.technical_role !== "owner") {
      return NextResponse.json(
        { error: "Somente um proprietário pode criar outro proprietário." },
        { status: 403 },
      );
    }

    if (cpf.length !== 11) {
      return NextResponse.json(
        { error: "Informe um CPF válido com 11 dígitos." },
        { status: 400 },
      );
    }

    if (!nome) {
      return NextResponse.json(
        { error: "Informe o nome do usuário." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha inicial deve ter pelo menos 6 caracteres." },
        { status: 400 },
      );
    }

    const admin = createServiceRoleClient();

    const seatErrorResponse = await ensureSeatAvailableForActivation({
      admin,
      organizationId: organization.id,
      organizationSeatsLimit: organization.seats_limit,
      targetMemberId: "",
    });

    if (seatErrorResponse) {
      return seatErrorResponse;
    }

    const technicalEmail = makeTechnicalEmailFromCpf(cpf);

    const { data: existingProfileByCpf, error: existingProfileByCpfError } =
      await admin
        .from("profiles")
        .select("user_id, cpf_cnpj, nome, email")
        .eq("cpf_cnpj", cpf)
        .maybeSingle<ExistingProfileRow>();

    if (existingProfileByCpfError) {
      console.error(
        "[governance/users] Erro ao buscar profile por CPF:",
        existingProfileByCpfError,
      );

      return NextResponse.json(
        { error: "Não foi possível verificar se o CPF já existe." },
        { status: 500 },
      );
    }

    let targetUserId: string;

    if (existingProfileByCpf?.user_id) {
      targetUserId = existingProfileByCpf.user_id;
    } else {
      const existingAuthUserId = await findAuthUserIdByEmail({
        admin,
        email: technicalEmail,
      });

      if (existingAuthUserId) {
        targetUserId = existingAuthUserId;
      } else {
        const { data: createdAuthUser, error: createAuthUserError } =
          await admin.auth.admin.createUser({
            email: technicalEmail,
            password,
            email_confirm: true,
            user_metadata: {
              nome,
              cpf_cnpj: cpf,
              source: "publia_governanca",
              organization_id: organization.id,
              organization_cnpj: organization.cnpj,
            },
          });

        if (createAuthUserError || !createdAuthUser.user) {
          console.error(
            "[governance/users] Erro ao criar usuário no Auth:",
            createAuthUserError,
          );

          return NextResponse.json(
            {
              error:
                createAuthUserError?.message ??
                "Não foi possível criar o usuário no Supabase Auth.",
            },
            { status: 500 },
          );
        }

        targetUserId = createdAuthUser.user.id;
      }
    }

    const cidadeUf =
      organization.municipality_name && organization.state_uf
        ? `${organization.municipality_name}/${organization.state_uf}`
        : null;

    try {
      await ensureProfile({
        admin,
        userId: targetUserId,
        cpf,
        nome,
        technicalEmail,
        cidadeUf,
      });
    } catch (profileError) {
      const message =
        profileError instanceof Error
          ? profileError.message
          : "Usuário criado, mas não foi possível criar o perfil.";

      return NextResponse.json({ error: message }, { status: 500 });
    }

    const { data: existingMembership, error: existingMembershipError } =
      await admin
        .from("organization_members")
        .select("id, status")
        .eq("organization_id", organization.id)
        .eq("user_id", targetUserId)
        .maybeSingle();

    if (existingMembershipError) {
      console.error(
        "[governance/users] Erro ao verificar vínculo existente:",
        existingMembershipError,
      );

      return NextResponse.json(
        { error: "Não foi possível verificar o vínculo com o órgão." },
        { status: 500 },
      );
    }

    if (existingMembership?.status === "active") {
      return NextResponse.json(
        { error: "Este CPF já está ativo neste órgão." },
        { status: 409 },
      );
    }

    if (existingMembership?.id) {
      const { error: updateMembershipError } = await admin
        .from("organization_members")
        .update({
          functional_role: functionalRole,
          technical_role: technicalRole,
          status: "active",
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMembership.id);

      if (updateMembershipError) {
        console.error(
          "[governance/users] Erro ao reativar vínculo:",
          updateMembershipError,
        );

        return NextResponse.json(
          { error: "Não foi possível reativar o usuário no órgão." },
          { status: 500 },
        );
      }
    } else {
      const { error: insertMembershipError } = await admin
        .from("organization_members")
        .insert({
          organization_id: organization.id,
          user_id: targetUserId,
          functional_role: functionalRole,
          technical_role: technicalRole,
          status: "active",
          invited_by: user.id,
          joined_at: new Date().toISOString(),
        });

      if (insertMembershipError) {
        console.error(
          "[governance/users] Erro ao criar vínculo com órgão:",
          insertMembershipError,
        );

        return NextResponse.json(
          { error: "Não foi possível vincular o usuário ao órgão." },
          { status: 500 },
        );
      }
    }

    await admin.from("organization_audit_logs").insert({
      organization_id: organization.id,
      actor_user_id: user.id,
      action: "organization_member.created",
      entity_type: "organization_member",
      entity_id: targetUserId,
      metadata: {
        source: "api/governance/users",
        cpf,
        nome,
        functional_role: functionalRole,
        technical_role: technicalRole,
        email: technicalEmail,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        user_id: targetUserId,
        cpf,
        nome,
        functional_role: functionalRole,
        technical_role: technicalRole,
        status: "active",
      },
    });
  } catch (error) {
    console.error("[governance/users] Erro inesperado:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao cadastrar usuário do órgão." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authenticated = await getAuthenticatedGovernanceContext();

    if (authenticated.errorResponse || !authenticated.user || !authenticated.context) {
      return authenticated.errorResponse;
    }

    const { user, context } = authenticated;
    const { organization, membership } = context;

    const body = (await request.json().catch(() => null)) as
      | UpdateGovernanceUserBody
      | null;

    const memberId = typeof body?.memberId === "string" ? body.memberId : "";

    if (!memberId) {
      return NextResponse.json(
        { error: "Informe o vínculo do usuário." },
        { status: 400 },
      );
    }

    const admin = createServiceRoleClient();

    const targetMembership = await getTargetMembership({
      admin,
      organizationId: organization.id,
      memberId,
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Vínculo não encontrado neste órgão." },
        { status: 404 },
      );
    }

    const targetErrorResponse = await assertCanChangeTarget({
      actorUserId: user.id,
      actorTechnicalRole: membership.technical_role,
      targetMembership,
    });

    if (targetErrorResponse) {
      return targetErrorResponse;
    }

    const updates: Partial<OrganizationMemberRow> & {
      updated_at?: string;
      joined_at?: string;
    } = {};

    let nextFunctionalRole: GovernanceFunctionalRole | undefined;
    let nextTechnicalRole: GovernanceTechnicalRole | undefined;
    let nextStatus: GovernanceMemberStatus | undefined;

    if (typeof body?.functionalRole === "string") {
      if (!isValidFunctionalRole(body.functionalRole)) {
        return NextResponse.json(
          { error: "Papel funcional inválido." },
          { status: 400 },
        );
      }

      nextFunctionalRole = body.functionalRole;
      updates.functional_role = nextFunctionalRole;
    }

    if (typeof body?.technicalRole === "string") {
      if (!isValidTechnicalRole(body.technicalRole)) {
        return NextResponse.json(
          { error: "Permissão técnica inválida." },
          { status: 400 },
        );
      }

      if (
        body.technicalRole === "owner" &&
        membership.technical_role !== "owner"
      ) {
        return NextResponse.json(
          { error: "Somente um proprietário pode definir outro proprietário." },
          { status: 403 },
        );
      }

      nextTechnicalRole = body.technicalRole;
      updates.technical_role = nextTechnicalRole;
    }

    if (typeof body?.status === "string") {
      if (!isValidPatchStatus(body.status)) {
        return NextResponse.json(
          { error: "Status inválido para esta operação." },
          { status: 400 },
        );
      }

      nextStatus = body.status;
      updates.status = nextStatus;

      if (nextStatus === "active" && targetMembership.status !== "active") {
        const seatErrorResponse = await ensureSeatAvailableForActivation({
          admin,
          organizationId: organization.id,
          organizationSeatsLimit: organization.seats_limit,
          targetMemberId: targetMembership.id,
        });

        if (seatErrorResponse) {
          return seatErrorResponse;
        }

        updates.joined_at = new Date().toISOString();
      }
    }

    const hasRoleChanges =
      (nextFunctionalRole !== undefined &&
        nextFunctionalRole !== targetMembership.functional_role) ||
      (nextTechnicalRole !== undefined &&
        nextTechnicalRole !== targetMembership.technical_role);

    const hasStatusChange =
      nextStatus !== undefined && nextStatus !== targetMembership.status;

    if (!hasRoleChanges && !hasStatusChange) {
      return NextResponse.json({
        ok: true,
        changed: false,
        message: "Nenhuma alteração necessária.",
      });
    }

    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await admin
      .from("organization_members")
      .update(updates)
      .eq("id", targetMembership.id)
      .eq("organization_id", organization.id);

    if (updateError) {
      console.error(
        "[governance/users] Erro ao atualizar vínculo:",
        updateError,
      );

      return NextResponse.json(
        { error: "Não foi possível atualizar o usuário." },
        { status: 500 },
      );
    }

    await admin.from("organization_audit_logs").insert({
      organization_id: organization.id,
      actor_user_id: user.id,
      action: getMembershipAction({
        before: targetMembership,
        afterStatus: nextStatus,
        hasRoleChanges,
      }),
      entity_type: "organization_member",
      entity_id: targetMembership.id,
      metadata: {
        source: "api/governance/users",
        target_user_id: targetMembership.user_id,
        before: {
          functional_role: targetMembership.functional_role,
          technical_role: targetMembership.technical_role,
          status: targetMembership.status,
        },
        after: {
          functional_role:
            nextFunctionalRole ?? targetMembership.functional_role,
          technical_role: nextTechnicalRole ?? targetMembership.technical_role,
          status: nextStatus ?? targetMembership.status,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      changed: true,
    });
  } catch (error) {
    console.error("[governance/users] Erro inesperado no PATCH:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao atualizar usuário do órgão." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const authenticated = await getAuthenticatedGovernanceContext();

    if (authenticated.errorResponse || !authenticated.user || !authenticated.context) {
      return authenticated.errorResponse;
    }

    const { user, context } = authenticated;
    const { organization, membership } = context;

    const body = (await request.json().catch(() => null)) as
      | DeleteGovernanceUserBody
      | null;

    const memberId = typeof body?.memberId === "string" ? body.memberId : "";

    if (!memberId) {
      return NextResponse.json(
        { error: "Informe o vínculo do usuário." },
        { status: 400 },
      );
    }

    const admin = createServiceRoleClient();

    const targetMembership = await getTargetMembership({
      admin,
      organizationId: organization.id,
      memberId,
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Vínculo não encontrado neste órgão." },
        { status: 404 },
      );
    }

    const targetErrorResponse = await assertCanChangeTarget({
      actorUserId: user.id,
      actorTechnicalRole: membership.technical_role,
      targetMembership,
    });

    if (targetErrorResponse) {
      return targetErrorResponse;
    }

    if (targetMembership.status === "removed") {
      return NextResponse.json({
        ok: true,
        changed: false,
        message: "O vínculo já estava removido.",
      });
    }

    const { error: updateError } = await admin
      .from("organization_members")
      .update({
        status: "removed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetMembership.id)
      .eq("organization_id", organization.id);

    if (updateError) {
      console.error("[governance/users] Erro ao remover vínculo:", updateError);

      return NextResponse.json(
        { error: "Não foi possível remover o vínculo do usuário." },
        { status: 500 },
      );
    }

    await admin.from("organization_audit_logs").insert({
      organization_id: organization.id,
      actor_user_id: user.id,
      action: "organization_member.removed",
      entity_type: "organization_member",
      entity_id: targetMembership.id,
      metadata: {
        source: "api/governance/users",
        target_user_id: targetMembership.user_id,
        before: {
          functional_role: targetMembership.functional_role,
          technical_role: targetMembership.technical_role,
          status: targetMembership.status,
        },
        after: {
          functional_role: targetMembership.functional_role,
          technical_role: targetMembership.technical_role,
          status: "removed",
        },
      },
    });

    return NextResponse.json({
      ok: true,
      changed: true,
    });
  } catch (error) {
    console.error("[governance/users] Erro inesperado no DELETE:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao remover vínculo do usuário." },
      { status: 500 },
    );
  }
}
