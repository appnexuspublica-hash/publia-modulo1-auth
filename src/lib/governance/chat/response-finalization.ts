// src/lib/governance/chat/response-finalization.ts

import { buildGovernanceFinalAnswer } from "@/lib/governance/knowledge-engine/response-builder";
import { buildOfficialLegalReferencesForGovernance } from "@/lib/governance/chat/official-legal-references";
import { filterGovernanceChatReferencesForClient } from "@/lib/governance/chat/reference-filter";
import {
  buildGovernanceChatReferences,
  mergeGovernanceChatReferences,
  type GovernanceChatReference,
  type GovernanceChatSource,
  type GovernanceChatSources,
} from "@/lib/governance/chat/references";
import { sanitizeGovernanceAssistantText } from "@/lib/governance/chat/response-sanitizer";

type FinalizeGovernanceResponseParams = {
  assistantText: string;
  question: string;
  responseSources: GovernanceChatSources;
  responseReferences: GovernanceChatReference[];
  officialWebSources: GovernanceChatSource[];
  forceWebFirst: boolean;
};

export function finalizeGovernanceResponse({
  assistantText,
  question,
  responseSources,
  responseReferences,
  officialWebSources,
  forceWebFirst,
}: FinalizeGovernanceResponseParams) {
  const sanitizedAssistantText = sanitizeGovernanceAssistantText({
    assistantText,
    question,
    institutionalSources: responseSources.institutional,
  });

  let mergedResponseReferences = mergeGovernanceChatReferences(
    responseReferences,
    buildGovernanceChatReferences({
      institutional: [],
      officialGazette: [],
      officialSources: [],
      externalSources: officialWebSources,
    }),
  );

  const officialLegalReferences = buildOfficialLegalReferencesForGovernance({
    question,
    answer: sanitizedAssistantText,
    forceWebFirst,
  });

  mergedResponseReferences = mergeGovernanceChatReferences(
    mergedResponseReferences,
    officialLegalReferences,
  );

  const finalResponseSources: GovernanceChatSources = {
    ...responseSources,
    externalSources: officialWebSources,
  };

  const finalAssistantText = buildGovernanceFinalAnswer({
    answer: sanitizedAssistantText,
    question,
    sources: finalResponseSources,
    references: mergedResponseReferences,
  });

  const responseReferencesForClient =
    filterGovernanceChatReferencesForClient(mergedResponseReferences, {
      question,
      answer: finalAssistantText,
    });

  return {
    assistantText: finalAssistantText,
    responseReferences: mergedResponseReferences,
    responseReferencesForClient,
    finalResponseSources,
    officialLegalReferences,
  };
}
