import { analyzeGovernanceQuery } from "@/lib/governance/knowledge-engine/analyzer";
import type {
  GovernanceRecoveryIntent,
  GovernanceRecoveryProvider,
} from "./types";

const ALL_INTERNAL: GovernanceRecoveryProvider[] = [
  "official_gazette",
  "institutional",
  "legal",
  "attachment",
];

export function classifyGovernanceRecoveryIntent(params: {
  question: string;
  allowWeb?: boolean;
  allowedProviders?: GovernanceRecoveryProvider[];
}): GovernanceRecoveryIntent {
  const analysis = analyzeGovernanceQuery(params.question);
  const requested = params.allowedProviders ?? ALL_INTERNAL;
  const allowWeb = Boolean(params.allowWeb && requested.includes("web"));

  let preferred: GovernanceRecoveryProvider[];

  switch (analysis.queryNature) {
    case "municipal_records":
      preferred = ["official_gazette", "institutional", "attachment"];
      break;
    case "institutional":
      preferred = ["institutional", "official_gazette", "attachment"];
      break;
    case "legal_general":
      preferred = ["legal", "institutional", "official_gazette", "attachment"];
      break;
    default:
      preferred = [...ALL_INTERNAL];
      break;
  }

  const allowedProviders = preferred.filter((provider) => requested.includes(provider));
  if (allowWeb) allowedProviders.push("web");

  return {
    topic: analysis.topic,
    queryNature: analysis.queryNature,
    normalizedQuestion: analysis.normalizedQuestion,
    allowedProviders,
    allowWeb,
  };
}
