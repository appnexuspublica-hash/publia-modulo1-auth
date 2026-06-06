// src/app/governanca/auditoria/page.tsx
import { redirect } from "next/navigation";

import GovernanceHeader from "../components/GovernanceHeader";
import GovernanceSidebar from "../components/GovernanceSidebar";
import AuditLogsClient from "./AuditLogsClient";
import {
  createReadonlySupabaseServerClient,
  getCurrentGovernanceOrganization,
} from "@/lib/governance/get-current-organization";
import {
  getGovernanceFunctionalRoleLabel,
  getGovernanceTechnicalRoleLabel,
  getOrganizationStatusLabel,
} from "@/types/governance";

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

  const userLabel =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "Usuário Governança";

  const canViewAudit = ["owner", "admin", "manager"].includes(
    membership.technical_role,
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5] text-slate-900">
      <GovernanceHeader
        userLabel={userLabel}
        userEmail={user.email ?? null}
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
          <AuditLogsClient
            organizationName={organization.name}
            canViewAudit={canViewAudit}
          />
        </main>
      </div>
    </div>
  );
}
