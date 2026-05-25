// src/app/api/governance/conversations/route.ts
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

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => null);

    const title =
      typeof body?.title === "string" && body.title.trim().length > 0
        ? body.title.trim()
        : "Nova conversa institucional";

    const category =
      typeof body?.category === "string" && body.category.trim().length > 0
        ? body.category.trim()
        : null;

    const responseMode =
      typeof body?.responseMode === "string" && body.responseMode.trim()
        ? body.responseMode.trim()
        : "objective";

    const visibility =
      body?.visibility === "organization" ? "organization" : "private";

    const { data, error } = await supabase.rpc(
      "create_governance_conversation",
      {
        p_organization_id: context.organization.id,
        p_title: title,
        p_category: category,
        p_response_mode: responseMode,
        p_visibility: visibility,
      },
    );

    if (error) {
      console.error("[governance] Erro ao criar conversa:", error);

      return NextResponse.json(
        { error: "Não foi possível criar a conversa institucional." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      conversation: data,
    });
  } catch (error) {
    console.error("[governance] Erro inesperado ao criar conversa:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao criar conversa institucional." },
      { status: 500 },
    );
  }
}