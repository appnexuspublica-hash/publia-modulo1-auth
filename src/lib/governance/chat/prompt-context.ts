import type { GovernanceConversationForChat } from "@/lib/governance/chat/authorization";
import type { GovernanceMessage } from "@/types/governance";

export type GovernanceOpenAIInputMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function buildGovernanceConversationContext(params: {
  organizationName: string;
  organizationId: string;
  conversation: GovernanceConversationForChat;
}) {
  const { organizationName, organizationId, conversation } = params;

  return [
    "CONTEXTO INSTITUCIONAL DO GOVERNANÇA",
    `- Organização: ${organizationName}`,
    `- organization_id: ${organizationId}`,
    `- Conversa: ${conversation.title}`,
    `- Categoria: ${conversation.category || "não informada"}`,
    `- Visibilidade: ${conversation.visibility}`,
    "",
    "REGRAS DE ISOLAMENTO",
    "- Responda apenas no contexto da organização atual.",
    "- Não presuma acesso a dados de outros órgãos.",
    "- Quando faltar informação local, diga que o órgão deve validar em sua base institucional ou norma própria.",
    "- Não afirme que consultou documentos institucionais se eles ainda não foram fornecidos nesta conversa.",
    "- Para temas jurídicos, contábeis, fiscais, licitatórios ou de controle, indique quando houver necessidade de revisão por área técnica competente.",
  ].join("\n");
}

export function mapGovernanceMessagesToOpenAIInput(
  messages: GovernanceMessage[],
  options?: {
    currentMessageOnly?: boolean;
  },
): GovernanceOpenAIInputMessage[] {
  const sourceMessages = options?.currentMessageOnly
    ? [...messages]
        .reverse()
        .filter((message) => message.role === "user")
        .slice(0, 1)
        .reverse()
    : messages;

  const relevantMessages = sourceMessages.filter((message) => {
    return (
      message.role === "user" ||
      message.role === "assistant" ||
      message.role === "system"
    );
  });

  return relevantMessages.map((message) => {
    if (message.role === "system") {
      return {
        role: "system",
        content: message.content,
      };
    }

    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content,
      };
    }

    return {
      role: "user",
      content: message.content,
    };
  });
}
