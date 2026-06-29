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

const allowedPriorities = new Set(["high", "medium", "low"]);
const allowedStatuses = new Set([
  "pending_review",
  "active",
  "inactive",
  "archived",
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

function normalizePriority(value: unknown) {
  if (typeof value !== "string") {
    return "medium";
  }

  return allowedPriorities.has(value) ? value : "medium";
}

function normalizeStatus(value: unknown) {
  if (typeof value !== "string") {
    return "active";
  }

  return allowedStatuses.has(value) ? value : "active";
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

async function resolveManageContext() {
  const supabase = createWritableSupabaseRouteClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      response: NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      ),
      context: null,
      user: null,
    };
  }

  const context = await getCurrentGovernanceOrganization(user.id);

  if (!context) {
    return {
      supabase,
      response: NextResponse.json(
        { error: "Usuário não vinculado a uma organização ativa." },
        { status: 403 },
      ),
      context: null,
      user,
    };
  }

  const allowedTechnicalRoles = ["owner", "admin", "manager"];

  if (!allowedTechnicalRoles.includes(context.membership.technical_role)) {
    return {
      supabase,
      response: NextResponse.json(
        { error: "Seu perfil não pode gerenciar Fontes Oficiais." },
        { status: 403 },
      ),
      context: null,
      user,
    };
  }

  return {
    supabase,
    response: null,
    context,
    user,
  };
}

const officialSourceSelect = `
  id,
  organization_id,
  name,
  source_type,
  url,
  status,
  priority,
  notes,
  created_by,
  reviewed_by,
  reviewed_at,
  created_at,
  updated_at
`;

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
      .select(officialSourceSelect)
      .eq("organization_id", context.organization.id)
      .neq("status", "archived")
      .order("priority", { ascending: true })
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
    const { supabase, response, context, user } = await resolveManageContext();

    if (response || !context || !user) {
      return (
        response ??
        NextResponse.json(
          { error: "Contexto de governança não encontrado." },
          { status: 403 },
        )
      );
    }

    const body = await request.json();

    const name = normalizeRequiredText(body?.name);
    const sourceType = normalizeSourceType(body?.sourceType);
    const url = normalizeUrl(body?.url);
    const priority = normalizePriority(body?.priority);
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
        status: "active",
        priority,
        notes,
        created_by: user.id,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .select(officialSourceSelect)
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

export async function PUT(request: Request) {
  try {
    const { supabase, response, context, user } = await resolveManageContext();

    if (response || !context || !user) {
      return (
        response ??
        NextResponse.json(
          { error: "Contexto de governança não encontrado." },
          { status: 403 },
        )
      );
    }

    const body = await request.json();

    const id = normalizeRequiredText(body?.id);

    if (!id) {
      return NextResponse.json(
        { error: "Informe a fonte oficial que será atualizada." },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };

    if ("name" in body) {
      const name = normalizeRequiredText(body?.name);

      if (!name) {
        return NextResponse.json(
          { error: "Informe o nome da fonte oficial." },
          { status: 400 },
        );
      }

      updateData.name = name;
    }

    if ("sourceType" in body) {
      updateData.source_type = normalizeSourceType(body?.sourceType);
    }

    if ("url" in body) {
      const url = normalizeUrl(body?.url);

      if (!url) {
        return NextResponse.json(
          { error: "Informe a URL da fonte oficial." },
          { status: 400 },
        );
      }

      updateData.url = url;
    }

    if ("priority" in body) {
      updateData.priority = normalizePriority(body?.priority);
    }

    if ("status" in body) {
      const status = normalizeStatus(body?.status);

      if (status === "archived") {
        return NextResponse.json(
          { error: "Use a ação de exclusão para arquivar uma fonte." },
          { status: 400 },
        );
      }

      updateData.status = status;
    }

    if ("notes" in body) {
      updateData.notes = normalizeNullableText(body?.notes);
    }

    const { data: source, error: updateError } = await supabase
      .from("official_sources")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", context.organization.id)
      .neq("status", "archived")
      .select(officialSourceSelect)
      .single();

    if (updateError) {
      console.error(
        "[governance] Erro ao atualizar fonte oficial:",
        updateError,
      );

      return NextResponse.json(
        { error: "Não foi possível atualizar a fonte oficial." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      source,
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao atualizar fonte oficial:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao atualizar fonte oficial." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, response, context, user } = await resolveManageContext();

    if (response || !context || !user) {
      return (
        response ??
        NextResponse.json(
          { error: "Contexto de governança não encontrado." },
          { status: 403 },
        )
      );
    }

    const body = await request.json();
    const id = normalizeRequiredText(body?.id);

    if (!id) {
      return NextResponse.json(
        { error: "Informe a fonte oficial que será excluída." },
        { status: 400 },
      );
    }

    const { error: deleteError } = await supabase
      .from("official_sources")
      .update({
        status: "archived",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", context.organization.id)
      .neq("status", "archived");

    if (deleteError) {
      console.error("[governance] Erro ao excluir fonte oficial:", deleteError);

      return NextResponse.json(
        { error: "Não foi possível excluir a fonte oficial." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      id,
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao excluir fonte oficial:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao excluir fonte oficial." },
      { status: 500 },
    );
  }
}
