import type { GovernanceMessage } from "@/types/governance";

import type { SuggestedNextQuestion } from "@/lib/governance/chat/suggestions";

export function buildGovernancePersistedResponsePayload(params: {
  userMessage: GovernanceMessage;
  assistantMessage: GovernanceMessage;
  conversationTitle: string;
  suggestions: SuggestedNextQuestion[];
}) {
  return {
    userMessage: params.userMessage,
    assistantMessage: params.assistantMessage,
    conversationTitle: params.conversationTitle,
    suggestions: params.suggestions,
  };
}
