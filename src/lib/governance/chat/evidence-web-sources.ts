import type { GovernanceChatSource } from "@/lib/governance/chat/references";

type GovernanceEvidenceSource = {
  title: string;
  url: string;
};

export function buildGovernanceEvidenceWebSources(
  sources: readonly GovernanceEvidenceSource[] | null | undefined,
): GovernanceChatSource[] {
  return (
    sources?.map((source, index) => ({
      id: `web-evidence-${index + 1}`,
      title: source.title,
      url: source.url,
      type: "fonte oficial validada antes da geração",
    })) ?? []
  );
}
