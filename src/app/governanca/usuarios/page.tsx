// src/app/governanca/usuarios/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
  UserX,
} from "lucide-react";

import GovernanceHeader from "../components/GovernanceHeader";
import GovernanceSidebar from "../components/GovernanceSidebar";
import {
  createReadonlySupabaseServerClient,
  getCurrentGovernanceOrganization,
} from "@/lib/governance/get-current-organization";
import {
  getGovernanceFunctionalRoleLabel,
  getGovernanceMemberStatusLabel,
  getGovernanceTechnicalRoleLabel,
  getOrganizationStatusLabel,
  type GovernanceFunctionalRole,
  type GovernanceMemberStatus,
  type GovernanceTechnicalRole,
} from "@/types/governance";

import GovernanceUserActions from "./GovernanceUserActions";
import NewGovernanceUserForm from "./NewGovernanceUserForm";

export const dynamic = "force-dynamic";

type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  functional_role: GovernanceFunctionalRole;
  technical_role: GovernanceTechnicalRole;
  status: GovernanceMemberStatus;
  created_at: string;
  updated_at: string;
  joined_at: string | null;
};

type ProfileRow = {
  user_id: string;
  cpf_cnpj: string | null;
  nome: string | null;
  email: string | null;
};

function createServiceRoleProfilesClient() {
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

function formatCpf(value: string | null | undefined) {
  if (!value) return "CPF não informado";

  const digits = value.replace(/\D/g, "");

  if (digits.length !== 11) {
    return value;
  }

  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function formatDateTime(value: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getStatusBadgeClass(status: GovernanceMemberStatus) {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "invited") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (status === "suspended") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-red-50 text-red-700 border-red-200";
}

function canViewUsersPage(technicalRole: GovernanceTechnicalRole) {
  return ["owner", "admin", "manager"].includes(technicalRole);
}

function canCreateUser(technicalRole: GovernanceTechnicalRole) {
  return ["owner", "admin"].includes(technicalRole);
}

export default async function GovernanceUsersPage() {
  const supabase = createReadonlySupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const context = await getCurrentGovernanceOrganization(user.id);

  if (!context) {
    redirect("/governanca");
  }

  const { organization, membership } = context;

  if (!canViewUsersPage(membership.technical_role)) {
    redirect("/governanca");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("cpf_cnpj, nome, email")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  const userLabel = currentProfile?.cpf_cnpj
    ? formatCpf(currentProfile.cpf_cnpj)
    : "CPF não informado";

  const { data: membersData, error: membersError } = await supabase
    .from("organization_members")
    .select(
      `
        id,
        organization_id,
        user_id,
        functional_role,
        technical_role,
        status,
        created_at,
        updated_at,
        joined_at
      `,
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: true });

  if (membersError) {
    console.error("[governance/users] Erro ao listar membros:", membersError);
  }

  const members = (membersData ?? []) as OrganizationMemberRow[];
  const memberUserIds = members.map((member) => member.user_id);

  let profilesByUserId = new Map<string, ProfileRow>();

  if (memberUserIds.length > 0) {
    let profilesData: ProfileRow[] | null = null;

    try {
      const profilesClient = createServiceRoleProfilesClient();

      const { data, error: profilesError } = await profilesClient
        .from("profiles")
        .select("user_id, cpf_cnpj, nome, email")
        .in("user_id", memberUserIds);

      if (profilesError) {
        console.error(
          "[governance/users] Erro ao listar perfis dos membros com service role:",
          profilesError,
        );
      }

      profilesData = (data ?? []) as ProfileRow[];
    } catch (profilesClientError) {
      console.error(
        "[governance/users] Erro ao criar client service role para profiles:",
        profilesClientError,
      );

      const { data, error: fallbackProfilesError } = await supabase
        .from("profiles")
        .select("user_id, cpf_cnpj, nome, email")
        .in("user_id", memberUserIds);

      if (fallbackProfilesError) {
        console.error(
          "[governance/users] Erro ao listar perfis dos membros com fallback:",
          fallbackProfilesError,
        );
      }

      profilesData = (data ?? []) as ProfileRow[];
    }

    profilesByUserId = new Map(
      ((profilesData ?? []) as ProfileRow[]).map((profile) => [
        profile.user_id,
        profile,
      ]),
    );
  }

  const activeMembers = members.filter((member) => member.status === "active");
  const invitedMembers = members.filter(
    (member) => member.status === "invited",
  );
  const suspendedMembers = members.filter(
    (member) => member.status === "suspended",
  );

  const adminMembers = members.filter((member) =>
    ["owner", "admin", "manager"].includes(member.technical_role),
  );

  const seatsLimitLabel = organization.seats_limit
    ? `${activeMembers.length}/${organization.seats_limit}`
    : `${activeMembers.length}/sem limite`;

  const cards = [
    {
      title: "Assentos ativos",
      value: seatsLimitLabel,
      description: "Usuários ativos em relação ao limite contratado.",
      icon: Users,
    },
    {
      title: "Administradores",
      value: String(adminMembers.length),
      description: "Usuários com permissão owner, admin ou manager.",
      icon: UserCog,
    },
    {
      title: "Convites",
      value: String(invitedMembers.length),
      description: "Usuários convidados aguardando ativação.",
      icon: UserCheck,
    },
    {
      title: "Suspensos",
      value: String(suspendedMembers.length),
      description: "Usuários sem acesso ativo ao Governança.",
      icon: UserX,
    },
  ];

  const canShowNewUserForm = canCreateUser(membership.technical_role);

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5] text-slate-900">
      <GovernanceHeader
        userLabel={userLabel}
        userEmail={null}
        organizationName={organization.name}
        organizationStatusLabel={getOrganizationStatusLabel(organization.status)}
      />

      <div className="flex min-h-0 flex-1">
        <GovernanceSidebar
          organizationName={organization.name}
          functionalRoleLabel={getGovernanceFunctionalRoleLabel(
            membership.functional_role,
          )}
          technicalRoleLabel={getGovernanceTechnicalRoleLabel(
            membership.technical_role,
          )}
        />

        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
          <section className="mb-7 rounded-3xl border border-[#dedede] bg-white p-7 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
                  <ShieldCheck size={14} />
                  Gestão de usuários
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                  Usuários do órgão
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Gerencie os usuários autorizados no Publ.IA Governança. Cada
                  usuário é identificado por CPF e vinculado ao CNPJ do órgão.
                </p>
              </div>

              <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-[#0f3a4a]">
                  Limite contratado
                </p>
                <p className="mt-1">
                  <strong>Assentos:</strong> {seatsLimitLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Usuários ativos contam no limite contratado.
                </p>
              </div>
            </div>
          </section>

          {canShowNewUserForm && <NewGovernanceUserForm />}

          <section className="mb-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.title}
                  className="rounded-3xl border border-[#dedede] bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
                      <Icon size={22} />
                    </div>

                    <span className="rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-slate-700">
                      {card.value}
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-slate-950">
                    {card.title}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {card.description}
                  </p>
                </article>
              );
            })}
          </section>

          <section className="rounded-3xl border border-[#dedede] bg-white shadow-sm">
            <div className="border-b border-[#dedede] p-5">
              <h2 className="text-lg font-bold text-slate-950">
                Membros vinculados
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Esta lista mostra os usuários vinculados ao órgão atual. O CPF
                vem de profiles; a permissão e o papel vêm de
                organization_members.
              </p>
            </div>

            {members.length === 0 ? (
              <div className="p-6">
                <div className="rounded-2xl border border-dashed border-[#dedede] bg-[#f8f8f8] p-6 text-sm text-slate-600">
                  Nenhum usuário vinculado a este órgão ainda.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
                  <thead className="bg-[#f8f8f8] text-xs uppercase text-slate-500">
                    <tr>
                      <th className="border-b border-[#dedede] px-5 py-3">
                        Usuário
                      </th>
                      <th className="border-b border-[#dedede] px-5 py-3">
                        CPF
                      </th>
                      <th className="border-b border-[#dedede] px-5 py-3">
                        Papel funcional
                      </th>
                      <th className="border-b border-[#dedede] px-5 py-3">
                        Permissão técnica
                      </th>
                      <th className="border-b border-[#dedede] px-5 py-3">
                        Status
                      </th>
                      <th className="border-b border-[#dedede] px-5 py-3">
                        Ativado em
                      </th>
                      <th className="border-b border-[#dedede] px-5 py-3">
                        Ações
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {members.map((member) => {
                      const profile = profilesByUserId.get(member.user_id);
                      const cpfLabel = formatCpf(profile?.cpf_cnpj);

                      return (
                        <tr
                          key={member.id}
                          className="border-b border-[#dedede] align-top last:border-b-0"
                        >
                          <td className="px-5 py-4">
                            <div>
                              <strong className="block text-slate-950">
                                {profile?.nome || "Nome não informado"}
                              </strong>
                              <span className="mt-1 block break-all text-xs text-slate-500">
                                user_id: {member.user_id}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {cpfLabel}
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {getGovernanceFunctionalRoleLabel(
                              member.functional_role,
                            )}
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {getGovernanceTechnicalRoleLabel(
                              member.technical_role,
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={[
                                "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                                getStatusBadgeClass(member.status),
                              ].join(" ")}
                            >
                              {getGovernanceMemberStatusLabel(member.status)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {formatDateTime(member.joined_at)}
                          </td>

                          <td className="px-5 py-4">
                            <GovernanceUserActions
                              memberId={member.id}
                              isCurrentUser={member.user_id === user.id}
                              actorTechnicalRole={membership.technical_role}
                              initialFunctionalRole={member.functional_role}
                              initialTechnicalRole={member.technical_role}
                              initialStatus={member.status}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
