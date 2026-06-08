// src/app/api/governance/auth/login/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function createSupabaseAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variáveis públicas do Supabase ausentes.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const cnpj = onlyDigits(body?.cnpj ?? "");
    const cpf = onlyDigits(body?.cpf ?? "");
    const password = String(body?.password ?? "");

    if (cnpj.length !== 14) {
      return NextResponse.json(
        {
          ok: false,
          error: "Informe um CNPJ válido.",
        },
        { status: 400 },
      );
    }

    if (cpf.length !== 11) {
      return NextResponse.json(
        {
          ok: false,
          error: "Informe um CPF válido.",
        },
        { status: 400 },
      );
    }

    if (!password) {
      return NextResponse.json(
        {
          ok: false,
          error: "Informe a senha.",
        },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id, cnpj, status")
      .eq("cnpj", cnpj)
      .maybeSingle();

    if (organizationError || !organization) {
      return NextResponse.json(
        {
          ok: false,
          error: "Órgão não encontrado.",
        },
        { status: 404 },
      );
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_id, email, cpf_cnpj")
      .eq("cpf_cnpj", cpf)
      .maybeSingle();

    if (profileError || !profile?.email || !profile?.user_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuário não encontrado.",
        },
        { status: 404 },
      );
    }

    const { data: member, error: memberError } = await admin
      .from("organization_members")
      .select("id, status")
      .eq("organization_id", organization.id)
      .eq("user_id", profile.user_id)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuário não vinculado ao órgão.",
        },
        { status: 403 },
      );
    }

    if (member.status !== "active") {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuário sem acesso ativo ao Governança.",
        },
        { status: 403 },
      );
    }

    const supabaseAuth = createSupabaseAuthClient();

    const { data: signInData, error: signInError } =
      await supabaseAuth.auth.signInWithPassword({
        email: profile.email,
        password,
      });

    if (signInError || !signInData.session) {
      return NextResponse.json(
        {
          ok: false,
          error: "CPF/CNPJ ou senha inválidos.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        redirectTo: "/governanca",
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[governance/auth/login]", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno ao autenticar.",
      },
      { status: 500 },
    );
  }
}
