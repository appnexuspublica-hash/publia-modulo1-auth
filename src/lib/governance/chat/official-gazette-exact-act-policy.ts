import { shouldUseOfficialGazetteContext } from "@/lib/governance/chat/context-policy";
import { extractOfficialGazetteExactActReference } from "@/lib/governance/chat/official-gazette-query";

export function isExclusiveOfficialGazetteExactActQuery(question: string) {
  return Boolean(
    extractOfficialGazetteExactActReference(question) &&
      shouldUseOfficialGazetteContext(question),
  );
}
