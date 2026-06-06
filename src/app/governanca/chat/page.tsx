// src/app/governanca/chat/page.tsx
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

function getUserLabel(user: {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, any>;
}) {
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : null;

  if (metadataName) return metadataName;

  if (user.email) {
    return user.email.split("@")[0] ?? user.email;
  }

  if (user.phone) return user.phone;

  return user.id;
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
      userLabel={getUserLabel(user)}
      userEmail={user.email ?? null}
      context={context}
      initialConversations={conversations}
      initialMessages={initialMessages}
    />
  );
}
