import type {
  GovernanceChatReference,
  GovernanceChatSource,
  GovernanceChatSources,
} from "@/lib/governance/chat/references";
import { sanitizeGovernanceAssistantText } from "@/lib/governance/chat/response-sanitizer";
import { canonicalizeGovernanceV2References } from "./reference-canonicalizer";

export function finalizeGovernanceV2Response(params: {
  assistantText: string;
  question: string;
  responseSources: GovernanceChatSources;
  responseReferences: GovernanceChatReference[];
  officialWebSources: GovernanceChatSource[];
  includeOfficialWebSources?: boolean;
}) {
  const assistantText = sanitizeGovernanceAssistantText({
    assistantText: params.assistantText,
    question: params.question,
    institutionalSources: params.responseSources.institutional,
  });

  const finalResponseSources: GovernanceChatSources = {
    institutional: params.responseSources.institutional,
    officialGazette: params.responseSources.officialGazette,
    officialSources: params.responseSources.officialSources,
    externalSources: [],
  };

  const references = canonicalizeGovernanceV2References({
    question: params.question,
    baseReferences: params.responseReferences,
    officialWebSources: params.officialWebSources,
    includeOfficialWebSources: Boolean(params.includeOfficialWebSources),
  });

  return {
    assistantText,
    responseReferences: references,
    responseReferencesForClient: references,
    finalResponseSources,
    officialLegalReferences: references.filter((reference) => reference.kind === "legal"),
  };
}
