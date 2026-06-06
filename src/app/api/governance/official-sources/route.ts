// src/app/api/governance/official-sources/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";

const allowedSourceTypes = new Set([
  "municipal_website",
  "official_gazette",
  "transparency_portal",
  "institutional_repository",
  "other",
]);

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

function normalizeSourceType(value: unknown) {
  if (typeof value !== "string") {
    return "other";
  }

  return allowedSourceTypes.has(value) ? value : "other";
}

function normalizeRequiredText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeNullableText(value: unknown) {
  const normalizedValue = normalizeRequiredText(value);
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeUrl(value: unknown) {
  const normalizedValue = normalizeRequiredText(value);

  if (!normalizedValue) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    return normalizedValue;
  }

  return `https://${normalizedValue}`;
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

    const { data, error } = await supabase
      .from("official_sources")
      .select(
        `
          id,
          organization_id,
          name,
          source_type,
          url,
          status,
          notes,
          created_by,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at
        `,
      )
      .eq("organization_id", context.organization.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[governance] Erro ao listar fontes oficiais:", error);

      return NextResponse.json(
        { error: "Não foi possível listar as fontes oficiais." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      sources: data ?? [],
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao listar fontes oficiais:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao listar fontes oficiais." },
      { status: 500 },
    );
  }
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

    const allowedTechnicalRoles = ["owner", "admin", "manager"];

    if (!allowedTechnicalRoles.includes(context.membership.technical_role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode gerenciar Fontes Oficiais." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const name = normalizeRequiredText(body?.name);
    const sourceType = normalizeSourceType(body?.sourceType);
    const url = normalizeUrl(body?.url);
    const notes = normalizeNullableText(body?.notes);

    if (!name) {
      return NextResponse.json(
        { error: "Informe o nome da fonte oficial." },
        { status: 400 },
      );
    }

    if (!url) {
      return NextResponse.json(
        { error: "Informe a URL da fonte oficial." },
        { status: 400 },
      );
    }

    const { data: source, error: insertError } = await supabase
      .from("official_sources")
      .insert({
        organization_id: context.organization.id,
        name,
        source_type: sourceType,
        url,
        status: "pending_review",
        notes,
        created_by: user.id,
      })
      .select(
        `
          id,
          organization_id,
          name,
          source_type,
          url,
          status,
          notes,
          created_by,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at
        `,
      )
      .single();

    if (insertError) {
      console.error(
        "[governance] Erro ao cadastrar fonte oficial:",
        insertError,
      );

      return NextResponse.json(
        { error: "Não foi possível cadastrar a fonte oficial." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      source,
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao cadastrar fonte oficial:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao cadastrar fonte oficial." },
      { status: 500 },
    );
  }
}
