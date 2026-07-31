// src/app/api/governance/auth/select-organization/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createReadonlySupabaseServerClient } from "@/lib/governance/get-current-organization";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const supabase = createReadonlySupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Usuário não autenticado." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const body = await request.json();
    const organizationId = String(body?.organizationId ?? "").trim();

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: "Organização não informada." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { ok: false, error: "Usuário não possui acesso ativo a este órgão." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const cookieStore = cookies();

    cookieStore.set("governance_organization_id", organizationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[governance/auth/select-organization]", error);

    return NextResponse.json(
      { ok: false, error: "Não foi possível selecionar o órgão." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
