// src/app/api/governance/official-gazette/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";

export const dynamic = "force-dynamic";

type GazettePayload = {
  id?: unknown;
  name?: unknown;
  url?: unknown;
  active?: unknown;
};

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

function normalizeRequiredText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeNullableId(value: unknown) {
  const normalizedValue = normalizeRequiredText(value);
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  return true;
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

async function getAuthenticatedGovernanceContext() {
  const supabase = createWritableSupabaseRouteClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      context: null,
      response: NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      ),
    };
  }

  const context = await getCurrentGovernanceOrganization(user.id);

  if (!context) {
    return {
      supabase,
      user,
      context: null,
      response: NextResponse.json(
        { error: "Usuário não vinculado a uma organização ativa." },
        { status: 403 },
      ),
    };
  }

  return {
    supabase,
    user,
    context,
    response: null,
  };
}

export async function GET() {
  try {
    const { supabase, context, response } =
      await getAuthenticatedGovernanceContext();

    if (response || !context) {
      return response;
    }

    const { data, error } = await supabase
      .from("governance_official_gazettes")
      .select(
        `
          id,
          organization_id,
          name,
          url,
          active,
          last_sync_at,
          created_at,
          updated_at
        `,
      )
      .eq("organization_id", context.organization.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[governance] Erro ao listar Diário Oficial:", error);

      return NextResponse.json(
        { error: "Não foi possível listar o Diário Oficial." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      gazettes: data ?? [],
    });
  } catch (error) {
    console.error("[governance] Erro inesperado ao listar Diário Oficial:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao listar o Diário Oficial." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, context, response } =
      await getAuthenticatedGovernanceContext();

    if (response || !context) {
      return response;
    }

    const allowedTechnicalRoles = ["owner", "admin", "manager"];

    if (!allowedTechnicalRoles.includes(context.membership.technical_role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode gerenciar o Diário Oficial." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as GazettePayload;

    const id = normalizeNullableId(body?.id);
    const name = normalizeRequiredText(body?.name);
    const url = normalizeUrl(body?.url);
    const active = normalizeBoolean(body?.active);

    if (!name) {
      return NextResponse.json(
        { error: "Informe o nome do Diário Oficial." },
        { status: 400 },
      );
    }

    if (!url) {
      return NextResponse.json(
        { error: "Informe a URL do Diário Oficial." },
        { status: 400 },
      );
    }

    if (id) {
      const { data: gazette, error: updateError } = await supabase
        .from("governance_official_gazettes")
        .update({
          name,
          url,
          active,
        })
        .eq("id", id)
        .eq("organization_id", context.organization.id)
        .select(
          `
            id,
            organization_id,
            name,
            url,
            active,
            last_sync_at,
            created_at,
            updated_at
          `,
        )
        .single();

      if (updateError) {
        console.error("[governance] Erro ao atualizar Diário Oficial:", updateError);

        return NextResponse.json(
          { error: "Não foi possível atualizar o Diário Oficial." },
          { status: 500 },
        );
      }

      return NextResponse.json({
        gazette,
      });
    }

    const { data: gazette, error: insertError } = await supabase
      .from("governance_official_gazettes")
      .insert({
        organization_id: context.organization.id,
        name,
        url,
        active,
      })
      .select(
        `
          id,
          organization_id,
          name,
          url,
          active,
          last_sync_at,
          created_at,
          updated_at
        `,
      )
      .single();

    if (insertError) {
      console.error("[governance] Erro ao cadastrar Diário Oficial:", insertError);

      return NextResponse.json(
        { error: "Não foi possível cadastrar o Diário Oficial." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      gazette,
    });
  } catch (error) {
    console.error("[governance] Erro inesperado ao salvar Diário Oficial:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao salvar o Diário Oficial." },
      { status: 500 },
    );
  }
}
