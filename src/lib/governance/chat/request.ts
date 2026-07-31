import type { GovernanceResponseMode } from "@/types/governance";

export const MAX_GOVERNANCE_USER_MESSAGE_LENGTH = 12000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_RESPONSE_MODES: readonly GovernanceResponseMode[] = [
  "objective",
  "summary",
  "checklist",
  "technical_opinion",
  "legal_opinion",
  "risk_analysis",
  "attention_points",
  "action_plan",
  "draft",
  "comparison",
  "manager_guidance",
];

export type GovernanceChatRequestBody = {
  conversationId?: string;
  content?: string;
  responseMode?: GovernanceResponseMode;
  selectedPdfAttachmentNames?: string[];
  selectedPdfFileIds?: string[];
  clientRequestId?: string;
};

export type ParsedGovernanceChatRequest = {
  conversationId: string;
  rawContent: string;
  content: string;
  requestedResponseMode: GovernanceResponseMode | undefined;
  selectedPdfAttachmentNames: string[];
  selectedPdfFileIds: string[];
  hasSelectedPdfAttachments: boolean;
  clientRequestId: string;
};

export function isValidGovernanceResponseMode(
  value: unknown,
): value is GovernanceResponseMode {
  return (
    typeof value === "string" &&
    ALLOWED_RESPONSE_MODES.includes(value as GovernanceResponseMode)
  );
}

export function normalizeGovernanceResponseMode(
  value: unknown,
  fallback: GovernanceResponseMode,
): GovernanceResponseMode {
  return isValidGovernanceResponseMode(value) ? value : fallback;
}

export function parseGovernanceChatRequestBody(
  body: GovernanceChatRequestBody | null,
): ParsedGovernanceChatRequest {
  const conversationId =
    typeof body?.conversationId === "string"
      ? body.conversationId.trim()
      : "";

  const rawContent =
    typeof body?.content === "string" ? body.content : "";

  const content = rawContent
    .trim()
    .slice(0, MAX_GOVERNANCE_USER_MESSAGE_LENGTH);

  const selectedPdfAttachmentNames = Array.isArray(
    body?.selectedPdfAttachmentNames,
  )
    ? body.selectedPdfAttachmentNames
        .filter((name): name is string => typeof name === "string")
        .map((name) => name.trim())
        .filter(Boolean)
    : [];

  const selectedPdfFileIds = Array.isArray(body?.selectedPdfFileIds)
    ? body.selectedPdfFileIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => UUID_PATTERN.test(id))
    : [];

  const clientRequestId =
    typeof body?.clientRequestId === "string" && UUID_PATTERN.test(body.clientRequestId.trim())
      ? body.clientRequestId.trim()
      : "";

  return {
    conversationId,
    rawContent,
    content,
    requestedResponseMode: body?.responseMode,
    selectedPdfAttachmentNames,
    selectedPdfFileIds,
    hasSelectedPdfAttachments:
      selectedPdfAttachmentNames.length > 0 || selectedPdfFileIds.length > 0,
    clientRequestId,
  };
}
