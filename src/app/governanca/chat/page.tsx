import { redirect } from "next/navigation";

import {
  createReadonlySupabaseServerClient,
  getCurrentGovernanceOrganization,
} from "@/lib/governance/get-current-organization";
import type {
  GovernanceConversation,
  GovernanceMessage,
} from "@/types/governance";

import GovernanceChatClient from "./GovernanceChatClient";

async function getUserCpfLabel(
  supabase: ReturnType<typeof createReadonlySupabaseServerClient>,
  userId: string,
) {
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("cpf_cnpj")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profileError && profile?.cpf_cnpj) {
      return profile.cpf_cnpj;
    }

    if (profileError) {
      console.error(
        "[governance/chat] Erro ao buscar CPF/CNPJ do profile:",
        profileError,
      );
    }
  } catch (profileError) {
    console.error(
      "[governance/chat] Erro inesperado ao buscar CPF/CNPJ do profile:",
      profileError,
    );
  }

  return "CPF não informado";
}

export default async function GovernanceChatPage() {
  const supabase = createReadonlySupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/governanca/login");
  }

  const context = await getCurrentGovernanceOrganization(user.id);

  if (!context) {
    redirect("/governanca");
  }

  const userLabel = await getUserCpfLabel(supabase, user.id);

  const { data: conversationsData, error: conversationsError } = await supabase
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
        is_pinned,
        metadata,
        created_at,
        updated_at,
        deleted_at
      `,
    )
    .eq("organization_id", context.organization.id)
    .eq("user_id", user.id)
    .eq("visibility", "private")
    .is("deleted_at", null)
    .neq("status", "deleted")
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(50);

  if (conversationsError) {
    console.error(
      "[governance/chat] Erro ao carregar conversas institucionais:",
      conversationsError,
    );
  }

  const conversations = (conversationsData ?? []) as GovernanceConversation[];
  const conversationIds = conversations.map((conversation) => conversation.id);

  let initialMessages: GovernanceMessage[] = [];

  if (conversationIds.length > 0) {
    const { data: messagesData, error: messagesError } = await supabase
      .from("governance_messages")
      .select(
        `
          id,
          organization_id,
          conversation_id,
          user_id,
          role,
          content,
          metadata,
          created_at
        `,
      )
      .eq("organization_id", context.organization.id)
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error(
        "[governance/chat] Erro ao carregar mensagens institucionais:",
        messagesError,
      );
    }

    initialMessages = (messagesData ?? []) as GovernanceMessage[];
  }

  return (
    <GovernanceChatClient
      userId={user.id}
      userLabel={userLabel}
      userEmail={null}
      context={context}
      initialConversations={conversations}
      initialMessages={initialMessages}
    />
  );
}
