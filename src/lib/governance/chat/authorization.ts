import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";
import type { GovernanceResponseMode } from "@/types/governance";

export type GovernanceConversationForChat = {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  category: string | null;
  response_mode: GovernanceResponseMode;
  visibility: "private" | "organization";
  status: "active" | "archived" | "deleted";
  deleted_at: string | null;
};

type GovernanceActorAuthorizationSuccess = {
  ok: true;
  user: {
    id: string;
  };
  context: NonNullable<
    Awaited<ReturnType<typeof getCurrentGovernanceOrganization>>
  >;
};

type GovernanceConversationAuthorizationSuccess = {
  ok: true;
  conversation: GovernanceConversationForChat;
};

type GovernanceChatAuthorizationFailure = {
  ok: false;
  status: 401 | 403 | 404 | 409 | 500;
  error: string;
};

export type GovernanceActorAuthorizationResult =
  | GovernanceActorAuthorizationSuccess
  | GovernanceChatAuthorizationFailure;

export type GovernanceConversationAuthorizationResult =
  | GovernanceConversationAuthorizationSuccess
  | GovernanceChatAuthorizationFailure;

export async function authenticateGovernanceActor(params: {
  supabase: any;
}): Promise<GovernanceActorAuthorizationResult> {
  const {
    data: { user },
    error: userError,
  } = await params.supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      status: 401,
      error: "Usuário não autenticado.",
    };
  }

  const context = await getCurrentGovernanceOrganization(user.id);

  if (!context) {
    return {
      ok: false,
      status: 403,
      error: "Usuário não vinculado a uma organização ativa.",
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
    },
    context,
  };
}

export async function authorizeGovernanceConversation(params: {
  supabase: any;
  conversationId: string;
  organizationId: string;
}): Promise<GovernanceConversationAuthorizationResult> {
  const { data: conversation, error: conversationError } =
    await params.supabase
      .from("governance_conversations")
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
          deleted_at
        `,
      )
      .eq("id", params.conversationId)
      .eq("organization_id", params.organizationId)
      .is("deleted_at", null)
      .neq("status", "deleted")
      .maybeSingle();

  if (conversationError) {
    console.error(
      "[governance/chat] Erro ao validar conversa:",
      conversationError,
    );

    return {
      ok: false,
      status: 500,
      error: "Não foi possível validar a conversa institucional.",
    };
  }

  if (!conversation) {
    return {
      ok: false,
      status: 404,
      error: "Conversa institucional não encontrada para este órgão.",
    };
  }

  const typedConversation = conversation as GovernanceConversationForChat;

  if (typedConversation.status !== "active") {
    return {
      ok: false,
      status: 409,
      error: "Esta conversa não está ativa para novas mensagens.",
    };
  }

  return {
    ok: true,
    conversation: typedConversation,
  };
}
