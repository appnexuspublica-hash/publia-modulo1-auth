// src/lib/governance/get-current-organization.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type {
  GovernanceContext,
  GovernanceMembership,
  GovernanceOrganization,
} from "@/types/governance";

type SupabaseOrganizationMemberRow = GovernanceMembership & {
  organizations: GovernanceOrganization | GovernanceOrganization[] | null;
};

export function createReadonlySupabaseServerClient() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(_name: string, _value: string, _options: any) {
        // Server Components não devem modificar cookies.
      },
      remove(_name: string, _options: any) {
        // Server Components não devem modificar cookies.
      },
    },
  });
}

function normalizeOrganization(
  value: SupabaseOrganizationMemberRow["organizations"],
): GovernanceOrganization | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export async function getCurrentGovernanceOrganization(
  userId: string,
): Promise<GovernanceContext | null> {
  const supabase = createReadonlySupabaseServerClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `
        id,
        organization_id,
        user_id,
        functional_role,
        technical_role,
        status,
        organizations (
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
          history_retention_policy
        )
      `,
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<SupabaseOrganizationMemberRow>();

  if (error) {
    console.error("[governance] Erro ao buscar organização atual:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  const organization = normalizeOrganization(data.organizations);

  if (!organization) {
    return null;
  }

  const membership: GovernanceMembership = {
    id: data.id,
    organization_id: data.organization_id,
    user_id: data.user_id,
    functional_role: data.functional_role,
    technical_role: data.technical_role,
    status: data.status,
  };

  return {
    organization,
    membership,
  };
}