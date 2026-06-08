import { redirect } from "next/navigation";

import GovernanceHeader from "../components/GovernanceHeader";
import GovernanceSidebar from "../components/GovernanceSidebar";
import {
  createReadonlySupabaseServerClient,
  getCurrentGovernanceOrganization,
} from "@/lib/governance/get-current-organization";
import {
  getGovernanceFunctionalRoleLabel,
  getGovernanceTechnicalRoleLabel,
  getOrganizationStatusLabel,
} from "@/types/governance";

import IndicatorsClient from "./IndicatorsClient";

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
    console.error("[governance/indicadores] Erro ao buscar CPF:", error);
  }

  return "CPF não informado";
}

export default async function GovernanceIndicatorsPage() {
  const supabase = createReadonlySupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/governanca/login");
  }

  const context = await getCurrentGovernanceOrganization(user.id);

  if (!context) {
    redirect("/governanca");
  }

  const { organization, membership } = context;

  const canViewIndicators = ["owner", "admin", "manager"].includes(
    membership.technical_role,
  );

  if (!canViewIndicators) {
    redirect("/governanca");
  }

  const userLabel = await getGovernanceUserLabel({
    supabase,
    userId: user.id,
  });

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
          <IndicatorsClient />
        </main>
      </div>
    </div>
  );
}
