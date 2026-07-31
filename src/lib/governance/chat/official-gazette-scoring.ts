import { normalizeOfficialGazetteSearchText } from "@/lib/governance/chat/official-gazette-query";
import type { OfficialGazetteContextChunkRow } from "@/lib/governance/chat/official-gazette-metadata";

export function scoreOfficialGazetteChunk(
  row: OfficialGazetteContextChunkRow,
  question: string,
  searchTerms: string[],
) {
  const normalizedQuestion = normalizeOfficialGazetteSearchText(question);
  const normalizedTitle = normalizeOfficialGazetteSearchText(row.title ?? "");
  const normalizedSectionType = normalizeOfficialGazetteSearchText(
    row.section_type ?? "",
  );
  const normalizedContent = normalizeOfficialGazetteSearchText(
    row.content ?? "",
  );
  const searchableText = [
    normalizedTitle,
    normalizedSectionType,
    normalizedContent,
  ].join(" ");

  let score = 0;

  for (const term of searchTerms) {
    if (!term) continue;

    if (normalizedTitle.includes(term)) {
      score += 4;
    }

    if (normalizedSectionType.includes(term)) {
      score += 3;
    }

    if (normalizedContent.includes(term)) {
      score += 1;
    }
  }

  if (
    normalizedQuestion.includes("decreto") &&
    searchableText.includes("decreto")
  ) {
    score += 10;
  }

  if (
    normalizedQuestion.includes("portaria") &&
    searchableText.includes("portaria")
  ) {
    score += 10;
  }

  if (
    normalizedQuestion.includes("resolucao") &&
    searchableText.includes("resolucao")
  ) {
    score += 10;
  }

  if (
    normalizedQuestion.includes("dispensa") &&
    searchableText.includes("dispensa")
  ) {
    score += 10;
  }

  if (
    normalizedQuestion.includes("licitacao") &&
    searchableText.includes("licitacao")
  ) {
    score += 6;
  }

  if (
    normalizedQuestion.includes("junho") &&
    searchableText.includes("junho")
  ) {
    score += 5;
  }

  return score;
}
