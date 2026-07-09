// src/app/api/governance/audit-logs/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";

function createWritableSupabaseRouteClient() {
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

export async function GET() {
  try {
    const supabase = createWritableSupabaseRouteClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      );
    }

    const context = await getCurrentGovernanceOrganization(user.id);

    if (!context) {
      return NextResponse.json(
        { error: "Usuário não vinculado a uma organização ativa." },
        { status: 403 },
      );
    }

    const allowedTechnicalRoles = ["owner", "admin", "manager"];

    if (!allowedTechnicalRoles.includes(context.membership.technical_role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode consultar a Auditoria." },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from("organization_audit_logs")
      .select(
        `
          id,
          organization_id,
          actor_user_id,
          action,
          entity_type,
          entity_id,
          metadata,
          created_at
        `,
      )
      .eq("organization_id", context.organization.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[governance] Erro ao listar auditoria:", error);

      return NextResponse.json(
        { error: "Não foi possível listar os registros de auditoria." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      logs: data ?? [],
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao listar auditoria:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao listar registros de auditoria." },
      { status: 500 },
    );
  }
}
