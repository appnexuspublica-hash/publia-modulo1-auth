// src/app/governanca/configuracoes/page.tsx
import { redirect } from "next/navigation";
import { Settings, ShieldAlert } from "lucide-react";

import GovernanceHeader from "../components/GovernanceHeader";
import GovernanceSidebar from "../components/GovernanceSidebar";
import {
  getGovernanceFunctionalRoleLabel,
  getGovernanceTechnicalRoleLabel,
  getOrganizationStatusLabel,
  type GovernanceTechnicalRole,
} from "@/types/governance";
import {
  createReadonlySupabaseServerClient,
  getCurrentGovernanceOrganization,
} from "@/lib/governance/get-current-organization";

import GovernanceSettingsClient from "./GovernanceSettingsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProfileRow = {
  cpf_cnpj: string | null;
};

function formatCpf(value: string | null | undefined) {
  if (!value) return "CPF não informado";

  const digits = value.replace(/\D/g, "");

  if (digits.length !== 11) {
    return value;
  }

  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function canManageSettings(technicalRole: GovernanceTechnicalRole) {
  return ["owner", "admin", "manager"].includes(technicalRole);
}

async function getGovernanceUserLabel(params: {
  supabase: ReturnType<typeof createReadonlySupabaseServerClient>;
  userId: string;
}) {
  const { supabase, userId } = params;

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("cpf_cnpj")
      .eq("user_id", userId)
      .maybeSingle<ProfileRow>();

    if (!error && profile?.cpf_cnpj) {
      return formatCpf(profile.cpf_cnpj);
    }
  } catch (error) {
    console.error("[governance/configuracoes] Erro ao buscar CPF:", error);
  }

  return "CPF não informado";
}

export default async function GovernanceSettingsPage() {
  const supabase = createReadonlySupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/governanca/login");
  }

  const userLabel = await getGovernanceUserLabel({
    supabase,
    userId: user.id,
  });

  const context = await getCurrentGovernanceOrganization(user.id);

  if (!context) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f5f5f5] text-slate-900">
        <GovernanceHeader
          userLabel={userLabel}
          userEmail={null}
          organizationName="Governança não configurada"
          organizationStatusLabel="Sem organização"
        />

        <main className="flex flex-1 items-center justify-center px-6">
          <section className="w-full max-w-2xl rounded-3xl border border-[#dedede] bg-white p-8 shadow-sm">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
              <ShieldAlert size={28} />
            </div>

            <h1 className="text-2xl font-bold text-slate-950">
              Acesso ao Governança não configurado
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Seu usuário está autenticado, mas ainda não foi vinculado a uma
              organização ativa do Publ.IA Governança.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const { organization, membership } = context;

  if (!canManageSettings(membership.technical_role)) {
    redirect("/governanca");
  }

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
          organizationLogoUrl={organization.logo_url}
          functionalRoleLabel={getGovernanceFunctionalRoleLabel(
            membership.functional_role,
          )}
          technicalRoleLabel={getGovernanceTechnicalRoleLabel(
            membership.technical_role,
          )}
        />

        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
          <section className="mb-7 rounded-3xl border border-[#dedede] bg-white p-7 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
                <Settings size={22} />
              </div>

              <div>
                <div className="mb-2 inline-flex rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
                  Configuração institucional
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                  Configurações
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Central de ajustes visuais e institucionais do órgão no
                  módulo Governança.
                </p>
              </div>
            </div>
          </section>

          <GovernanceSettingsClient
            organizationId={organization.id}
            organizationName={organization.name}
            currentLogoUrl={organization.logo_url}
          />
        </main>
      </div>
    </div>
  );
}
