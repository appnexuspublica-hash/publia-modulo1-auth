// src/app/governanca/conversas/[conversationId]/page.tsx
import { notFound, redirect } from "next/navigation";

import {
  createReadonlySupabaseServerClient,
  getCurrentGovernanceOrganization,
} from "@/lib/governance/get-current-organization";
import type {
  GovernanceConversation,
  GovernanceMessage,
} from "@/types/governance";

import GovernanceConversationDetailClient from "./GovernanceConversationDetailClient";

type GovernanceConversationDetailPageProps = {
  params: {
    conversationId: string;
  };
};

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

export default async function GovernanceConversationDetailPage({
  params,
}: GovernanceConversationDetailPageProps) {
  const supabase = createReadonlySupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getCurrentGovernanceOrganization(user.id);

  if (!context) {
    redirect("/governanca");
  }

  const conversationId = params.conversationId;

  const { data: conversationData, error: conversationError } = await supabase
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
    .eq("id", conversationId)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .neq("status", "deleted")
    .maybeSingle();

  if (conversationError) {
    console.error(
      "[governance] Erro ao carregar conversa institucional:",
      conversationError,
    );
    notFound();
  }

  if (!conversationData) {
    notFound();
  }

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
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error(
      "[governance] Erro ao carregar mensagens da conversa institucional:",
      messagesError,
    );
  }

  return (
    <GovernanceConversationDetailClient
      userId={user.id}
      userLabel={getUserLabel(user)}
      userEmail={user.email ?? null}
      context={context}
      conversation={conversationData as GovernanceConversation}
      initialMessages={(messagesData ?? []) as GovernanceMessage[]}
    />
  );
}