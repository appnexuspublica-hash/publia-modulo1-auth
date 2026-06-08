// src/app/governanca/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

import GovernanceShell from "./GovernanceShell";
import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function createReadonlySupabaseServerClient() {
  const cookieStore = cookies();

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

export default async function GovernancePage() {
  const supabase = createReadonlySupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/governanca/login");
  }

  let userLabel = "CPF não informado";

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("cpf_cnpj")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profileError && profile?.cpf_cnpj) {
      userLabel = profile.cpf_cnpj;
    }

    if (profileError) {
      console.error("[governanca/page] Erro ao buscar profile:", profileError);
    }
  } catch (profileError) {
    console.error("[governanca/page] Erro inesperado ao buscar profile:", profileError);
  }

  const governanceContext = await getCurrentGovernanceOrganization(user.id);

  return (
    <GovernanceShell
      userLabel={userLabel}
      userEmail={user.email ?? null}
      context={governanceContext}
    />
  );
}
