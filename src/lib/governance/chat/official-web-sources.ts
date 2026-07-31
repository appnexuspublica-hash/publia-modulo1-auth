import {
  collectOfficialWebSources,
  collectOfficialWebSourcesFromText,
} from "@/lib/official-web/source-collector";
import type { GovernanceChatSource } from "@/lib/governance/chat/references";

type CollectGovernanceOfficialWebSourcesParams = {
  response: unknown;
  allowedDomains: string[];
};

export function collectGovernanceOfficialWebSources({
  response,
  allowedDomains,
}: CollectGovernanceOfficialWebSourcesParams): GovernanceChatSource[] {
  return collectOfficialWebSources(response, {
    allowedDomains,
    maxItems: 8,
  }).map((source, index) => ({
    id: `web-${index + 1}`,
    title: source.title,
    url: source.url,
    type: "fonte oficial web",
  }));
}

type CollectGovernanceOfficialWebSourcesFromTextParams = {
  text: string;
  allowedDomains: string[];
};

export function collectGovernanceOfficialWebSourcesFromText({
  text,
  allowedDomains,
}: CollectGovernanceOfficialWebSourcesFromTextParams): GovernanceChatSource[] {
  return collectOfficialWebSourcesFromText(text, {
    allowedDomains,
    maxItems: 8,
  }).map((source, index) => ({
    id: `web-answer-${index + 1}`,
    title: source.title,
    url: source.url,
    type: "fonte oficial web citada na resposta",
  }));
}

type MergeGovernanceOfficialWebSourcesParams = {
  preferredSources: GovernanceChatSource[];
  currentSources: GovernanceChatSource[];
};

export function mergeGovernanceOfficialWebSources({
  preferredSources,
  currentSources,
}: MergeGovernanceOfficialWebSourcesParams): GovernanceChatSource[] {
  if (preferredSources.length === 0) {
    return currentSources;
  }

  const mergedOfficialWebSources = new Map<string, GovernanceChatSource>();

  for (const source of [...preferredSources, ...currentSources]) {
    const key = String(source.url ?? source.title).trim().toLowerCase();
    const existing = mergedOfficialWebSources.get(key);

    if (
      !existing ||
      String(source.title ?? "").length > String(existing.title ?? "").length
    ) {
      mergedOfficialWebSources.set(key, source);
    }
  }

  return Array.from(mergedOfficialWebSources.values()).slice(0, 8);
}

type AppendGovernanceOfficialWebSourcesParams = {
  currentSources: GovernanceChatSource[];
  collectedSources: GovernanceChatSource[];
};

export function appendGovernanceOfficialWebSources({
  currentSources,
  collectedSources,
}: AppendGovernanceOfficialWebSourcesParams): GovernanceChatSource[] {
  const uniqueSources = new Map<string, GovernanceChatSource>();

  for (const source of [...currentSources, ...collectedSources]) {
    const key = String(source.url ?? source.title).toLowerCase();

    if (!uniqueSources.has(key)) {
      uniqueSources.set(key, source);
    }
  }

  return Array.from(uniqueSources.values()).slice(0, 8);
}
