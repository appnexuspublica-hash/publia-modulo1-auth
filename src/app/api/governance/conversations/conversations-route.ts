import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";
import type {
  GovernanceConversationVisibility,
  GovernanceResponseMode,
} from "@/types/governance";

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

const allowedResponseModes: GovernanceResponseMode[] = [
  "objective",
  "summary",
  "checklist",
  "technical_opinion",
  "risk_analysis",
  "attention_points",
  "action_plan",
  "draft",
  "comparison",
  "manager_guidance",
];

function isValidGovernanceResponseMode(
  value: unknown,
): value is GovernanceResponseMode {
  return (
    typeof value === "string" &&
    allowedResponseModes.includes(value as GovernanceResponseMode)
  );
}

function normalizeResponseMode(value: unknown): GovernanceResponseMode {
  return isValidGovernanceResponseMode(value) ? value : "objective";
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
        : "Nova conversa";

    const category =
      typeof body?.category === "string" && body.category.trim().length > 0
        ? body.category.trim()
        : null;

    const responseMode = normalizeResponseMode(body?.responseMode);

    // Blindagem P0:
    // por padrão, toda conversa do Governança é privada do usuário logado.
    // A visibilidade "organization" fica reservada para fluxo futuro com
    // compartilhamento institucional explícito.
    const visibility: GovernanceConversationVisibility = "private";

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

    const conversation = Array.isArray(data) ? data[0] : data;

    if (!conversation?.id) {
      return NextResponse.json(
        { error: "A conversa foi criada, mas a API não retornou o ID." },
        { status: 500 },
      );
    }

    // Garantia adicional: se a função SQL não preencher user_id, vinculamos
    // a conversa ao usuário autenticado imediatamente.
    if (!conversation.user_id || conversation.user_id !== user.id) {
      const { data: fixedConversation, error: fixConversationError } =
        await supabase
          .from("governance_conversations")
          .update({
            user_id: user.id,
            visibility: "private",
            response_mode: responseMode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.id)
          .eq("organization_id", context.organization.id)
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

      if (fixConversationError) {
        console.error(
          "[governance] Conversa criada, mas não foi possível vincular ao usuário:",
          fixConversationError,
        );

        return NextResponse.json(
          {
            error:
              "A conversa foi criada, mas não foi possível vincular ao usuário autenticado.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        conversation: fixedConversation ?? {
          ...conversation,
          user_id: user.id,
          response_mode: responseMode,
          visibility: "private",
        },
      });
    }

    if (conversation.response_mode !== responseMode) {
      const { data: fixedResponseModeConversation, error: fixResponseModeError } =
        await supabase
          .from("governance_conversations")
          .update({
            response_mode: responseMode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.id)
          .eq("organization_id", context.organization.id)
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

      if (fixResponseModeError) {
        console.error(
          "[governance] Conversa criada, mas não foi possível ajustar o modo de resposta:",
          fixResponseModeError,
        );

        return NextResponse.json(
          {
            error:
              "A conversa foi criada, mas não foi possível ajustar o modo de resposta.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        conversation: fixedResponseModeConversation ?? {
          ...conversation,
          response_mode: responseMode,
        },
      });
    }

    return NextResponse.json({
      conversation,
    });
  } catch (error) {
    console.error("[governance] Erro inesperado ao criar conversa:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao criar conversa institucional." },
      { status: 500 },
    );
  }
}
