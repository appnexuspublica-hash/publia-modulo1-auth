import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { GovernanceConversationForChat } from "@/lib/governance/chat/authorization";
import type {
  GovernanceMessage,
  GovernanceResponseMode,
} from "@/types/governance";

type GovernanceSupabaseClient = SupabaseClient;

type UpdateConversationResponseModeParams = {
  supabase: GovernanceSupabaseClient;
  conversation: GovernanceConversationForChat;
  organizationId: string;
  responseMode: GovernanceResponseMode;
};

export async function updateGovernanceConversationResponseMode(
  params: UpdateConversationResponseModeParams,
) {
  const {
    supabase,
    conversation,
    organizationId,
    responseMode,
  } = params;

  if (responseMode === conversation.response_mode) {
    return {
      updated: false,
      error: null,
    };
  }

  const { error } = await supabase
    .from("governance_conversations")
    .update({
      response_mode: responseMode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversation.id)
    .eq("organization_id", organizationId);

  if (!error) {
    conversation.response_mode = responseMode;
  }

  return {
    updated: !error,
    error,
  };
}

function sanitizeGovernanceUserPdfMessageContent(content: string) {
  const rawContent = String(content ?? "").replace(/\r\n/g, "\n").trim();
  const attachmentMarker = "PDFs selecionados para esta pergunta:";
  const markerIndex = rawContent.indexOf(attachmentMarker);

  if (markerIndex < 0) {
    return rawContent;
  }

  const beforeMarker = rawContent.slice(0, markerIndex);
  const afterMarker = rawContent.slice(markerIndex + attachmentMarker.length);
  const actionLine = beforeMarker
    .split("\n")
    .map((line) => line.trim())
    .find((line) =>
      Boolean(line) &&
      !line.startsWith("Considere os PDFs selecionados") &&
      !line.startsWith("Não use PDFs anteriores") &&
      !line.startsWith("Instrução operacional:"),
    );
  const attachmentLines = afterMarker
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));

  return [
    actionLine ?? "",
    attachmentLines.length > 0 ? attachmentMarker : "",
    ...attachmentLines,
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

type SaveGovernanceUserMessageParams = {
  supabase: GovernanceSupabaseClient;
  organizationId: string;
  conversationId: string;
  userId: string;
  content: string;
  responseMode: GovernanceResponseMode;
  selectedPdfAttachmentNames: string[];
  selectedPdfFileIds: string[];
  clientRequestId: string;
  source?: "governance_chat" | "governance_conversations_ui";
};

export async function saveGovernanceUserMessage(
  params: SaveGovernanceUserMessageParams,
): Promise<{
  message: GovernanceMessage | null;
  error: unknown;
  duplicate: boolean;
}> {
  const {
    supabase,
    organizationId,
    conversationId,
    userId,
    content,
    responseMode,
    selectedPdfAttachmentNames,
    selectedPdfFileIds,
    clientRequestId,
    source = "governance_chat",
  } = params;

  const messageSelect = `
    id,
    organization_id,
    conversation_id,
    user_id,
    role,
    content,
    metadata,
    created_at
  `;

  const { data, error } = await supabase
    .from("governance_messages")
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      user_id: userId,
      role: "user",
      content: sanitizeGovernanceUserPdfMessageContent(content),
      metadata: {
        source,
        product_tier: "governance",
        response_mode: responseMode,
        selected_pdf_attachment_names: selectedPdfAttachmentNames,
        selected_pdf_file_ids: selectedPdfFileIds,
        client_request_id: clientRequestId,
        processing_status: "processing",
        processing_started_at: new Date().toISOString(),
        processing_attempt_id: randomUUID(),
        processing_attempt_count: 1,
      },
    })
    .select(messageSelect)
    .single();

  const postgresError = error as { code?: string; message?: string } | null;

  if (postgresError?.code === "23505") {
    const { data: existingMessage, error: lookupError } = await supabase
      .from("governance_messages")
      .select(messageSelect)
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .eq("role", "user")
      .eq("metadata->>client_request_id", clientRequestId)
      .limit(1)
      .maybeSingle();

    return {
      message: existingMessage
        ? (existingMessage as GovernanceMessage)
        : null,
      error: lookupError,
      duplicate: true,
    };
  }

  return {
    message: data ? (data as GovernanceMessage) : null,
    error,
    duplicate: false,
  };
}

function isDefaultConversationTitle(title: string | null | undefined) {
  const normalized = String(title ?? "").trim().toLowerCase();

  return (
    normalized === "" ||
    normalized === "nova conversa" ||
    normalized === "nova conversa institucional"
  );
}

function buildConversationTitleFromMessage(content: string) {
  const clean = String(content ?? "")
    .split("\nPDFs selecionados para esta pergunta:")[0]
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return "Conversa";
  }

  if (clean.length <= 54) {
    return clean;
  }

  return `${clean.slice(0, 54).trim()}...`;
}

type UpdateConversationTitleFromMessageParams = {
  supabase: GovernanceSupabaseClient;
  conversation: GovernanceConversationForChat;
  organizationId: string;
  content: string;
};

export async function updateConversationTitleFromMessage(
  params: UpdateConversationTitleFromMessageParams,
) {
  const {
    supabase,
    conversation,
    organizationId,
    content,
  } = params;

  if (!isDefaultConversationTitle(conversation.title)) {
    return conversation.title;
  }

  // O título deve permanecer vinculado à primeira mensagem do usuário.
  const { data, error: firstUserMessageError } = await supabase
    .from("governance_messages")
    .select("content")
    .eq("conversation_id", conversation.id)
    .eq("organization_id", organizationId)
    .eq("role", "user")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstUserMessageError) {
    console.warn(
      "[governance/chat] Não foi possível buscar a primeira mensagem para compor o título:",
      firstUserMessageError,
    );
  }

  const firstUserMessage = data as { content?: string | null } | null;
  const titleSource =
    typeof firstUserMessage?.content === "string" &&
    firstUserMessage.content.trim().length > 0
      ? firstUserMessage.content
      : content;

  const nextTitle = buildConversationTitleFromMessage(titleSource);

  const { error } = await supabase
    .from("governance_conversations")
    .update({
      title: nextTitle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversation.id)
    .eq("organization_id", organizationId);

  if (error) {
    console.warn(
      "[governance/chat] Mensagem salva, mas não foi possível atualizar o título da conversa:",
      error,
    );

    return conversation.title;
  }

  conversation.title = nextTitle;

  return nextTitle;
}

type TouchGovernanceConversationParams = {
  supabase: GovernanceSupabaseClient;
  conversationId: string;
  organizationId: string;
};

export async function touchGovernanceConversation(
  params: TouchGovernanceConversationParams,
) {
  const {
    supabase,
    conversationId,
    organizationId,
  } = params;

  return supabase
    .from("governance_conversations")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("organization_id", organizationId);
}


export async function touchGovernanceConversationAfterResponse(
  params: TouchGovernanceConversationParams,
): Promise<void> {
  const { error: updateConversationError } =
    await touchGovernanceConversation(params);

  if (updateConversationError) {
    console.warn(
      "[governance/chat] Mensagens salvas, mas não foi possível atualizar a conversa:",
      updateConversationError,
    );
  }
}


export function createGovernanceConversationToucher(
  params: TouchGovernanceConversationParams,
) {
  return () => touchGovernanceConversationAfterResponse(params);
}

type SaveGovernanceAssistantMessageParams = {
  supabase: GovernanceSupabaseClient;
  organizationId: string;
  conversationId: string;
  content: string;
  metadata: Record<string, unknown>;
};

export async function saveGovernanceAssistantMessage(
  params: SaveGovernanceAssistantMessageParams,
): Promise<{
  message: GovernanceMessage | null;
  error: unknown;
  duplicate: boolean;
}> {
  const {
    supabase,
    organizationId,
    conversationId,
    content,
    metadata,
  } = params;

  const messageSelect = `
    id,
    organization_id,
    conversation_id,
    user_id,
    role,
    content,
    metadata,
    created_at
  `;

  const { data, error } = await supabase
    .from("governance_messages")
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      user_id: null,
      role: "assistant",
      content,
      metadata,
    })
    .select(messageSelect)
    .single();

  const postgresError = error as { code?: string; message?: string } | null;
  const clientRequestId =
    typeof metadata.client_request_id === "string"
      ? metadata.client_request_id.trim()
      : "";

  if (postgresError?.code === "23505" && clientRequestId) {
    const { data: existingMessage, error: lookupError } = await supabase
      .from("governance_messages")
      .select(messageSelect)
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .eq("role", "assistant")
      .eq("metadata->>client_request_id", clientRequestId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    return {
      message: existingMessage
        ? (existingMessage as GovernanceMessage)
        : null,
      error: lookupError,
      duplicate: true,
    };
  }

  return {
    message: data ? (data as GovernanceMessage) : null,
    error,
    duplicate: false,
  };
}

type CreateGovernanceAssistantMessageSaverParams = Pick<
  SaveGovernanceAssistantMessageParams,
  "supabase" | "organizationId" | "conversationId"
>;

type GovernanceAssistantMessageToSave = Omit<
  SaveGovernanceAssistantMessageParams,
  "supabase" | "organizationId" | "conversationId"
>;

export function createGovernanceAssistantMessageSaver(
  params: CreateGovernanceAssistantMessageSaverParams,
) {
  return (message: GovernanceAssistantMessageToSave) =>
    saveGovernanceAssistantMessage({
      ...params,
      ...message,
    });
}
