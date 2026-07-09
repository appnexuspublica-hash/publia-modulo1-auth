import { redirect } from "next/navigation";

import GovernancePageFrame from "../components/GovernancePageFrame";
import AuditLogsClient from "./AuditLogsClient";
import {
  createReadonlySupabaseServerClient,
  getCurrentGovernanceOrganization,
} from "@/lib/governance/get-current-organization";

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
    console.error("[governance/auditoria] Erro ao buscar CPF:", error);
  }

  return "CPF não informado";
}

export default async function GovernanceAuditPage() {
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

  const userLabel = await getGovernanceUserLabel({
    supabase,
    userId: user.id,
  });

  const canViewAudit = ["owner", "admin", "manager"].includes(
    membership.technical_role,
  );

  return (
    <GovernancePageFrame userLabel={userLabel} userEmail={null} context={context}>
      <AuditLogsClient
        organizationName={organization.name}
        canViewAudit={canViewAudit}
      />
    </GovernancePageFrame>
  );
}
