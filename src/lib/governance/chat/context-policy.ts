import {
  isAdministrativeStructureQuestion,
  isCareerProgressionQuestion,
  isMunicipalCreationLawQuestion,
} from "@/lib/governance/chat/institutional-query";
import { hasOfficialGazetteTrigger } from "@/lib/governance/chat/official-gazette-query";

export function shouldSuppressExternalGovernanceContext(question: string) {
  return (
    isMunicipalCreationLawQuestion(question) ||
    isAdministrativeStructureQuestion(question) ||
    isCareerProgressionQuestion(question)
  );
}

export function shouldUseOfficialGazetteContext(question: string) {
  if (shouldSuppressExternalGovernanceContext(question)) {
    return false;
  }

  return hasOfficialGazetteTrigger(question);
}
