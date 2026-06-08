import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";

type GovernanceConversationRouteProps = {
  params: {
    conversationId: string;
  };
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

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getSafeConversationId(params: GovernanceConversationRouteProps["params"]) {
  return typeof params?.conversationId === "string"
    ? params.conversationId.trim()
    : "";
}

export async function PATCH(
  request: Request,
  { params }: GovernanceConversationRouteProps,
) {
  try {
    const conversationId = getSafeConversationId(params);

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversa institucional não informada." },
        { status: 400 },
      );
    }

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

    const title = typeof body?.title === "string" ? body.title.trim() : null;

    const hasTitle = title !== null;
    const hasPinned = typeof body?.is_pinned === "boolean";

    if (!hasTitle && !hasPinned) {
      return NextResponse.json(
        { error: "Informe um título ou o estado de fixação da conversa." },
        { status: 400 },
      );
    }

    if (hasTitle && !title) {
      return NextResponse.json(
        { error: "Informe um título para renomear a conversa." },
        { status: 400 },
      );
    }

    const updatePayload: {
      title?: string;
      is_pinned?: boolean;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (hasTitle && title) {
      updatePayload.title = title;
    }

    if (hasPinned) {
      updatePayload.is_pinned = body.is_pinned;
    }

    const admin = createSupabaseAdminClient();

    const { data: conversation, error } = await admin
      .from("governance_conversations")
      .update(updatePayload)
      .eq("id", conversationId)
      .eq("organization_id", context.organization.id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select(
        `
          id,
          organization_id,
          user_id,
          title,
          category,
          response_mode,
          visibility,
          status,
          is_pinned,
          metadata,
          created_at,
          updated_at,
          deleted_at
        `,
      )
      .maybeSingle();

    if (error) {
      console.error("[governance] Erro ao atualizar conversa:", error);

      return NextResponse.json(
        {
          error: "Não foi possível atualizar a conversa institucional.",
          details: error.message,
        },
        { status: 500 },
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa institucional não encontrada para este usuário." },
        { status: 404 },
      );
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("[governance] Erro inesperado ao atualizar conversa:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao atualizar conversa institucional." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: GovernanceConversationRouteProps,
) {
  try {
    const conversationId = getSafeConversationId(params);

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversa institucional não informada." },
        { status: 400 },
      );
    }

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

    const { data: existingConversation, error: existingConversationError } =
      await supabase
        .from("governance_conversations")
        .select("id, organization_id, user_id, deleted_at")
        .eq("id", conversationId)
        .eq("organization_id", context.organization.id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

    if (existingConversationError) {
      console.error(
        "[governance] Erro ao validar conversa antes da exclusão:",
        existingConversationError,
      );

      return NextResponse.json(
        {
          error: "Não foi possível validar a conversa institucional.",
          details: existingConversationError.message,
        },
        { status: 500 },
      );
    }

    if (!existingConversation) {
      return NextResponse.json(
        { error: "Conversa institucional não encontrada para este usuário." },
        { status: 404 },
      );
    }

    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { error: deleteError } = await admin
      .from("governance_conversations")
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq("id", conversationId)
      .eq("organization_id", context.organization.id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[governance] Erro ao excluir conversa:", deleteError);

      return NextResponse.json(
        {
          error: "Não foi possível excluir a conversa institucional.",
          details: deleteError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      conversationId,
    });
  } catch (error) {
    console.error("[governance] Erro inesperado ao excluir conversa:", error);

    return NextResponse.json(
      {
        error: "Erro inesperado ao excluir conversa institucional.",
        details: error instanceof Error ? error.message : null,
      },
      { status: 500 },
    );
  }
}
