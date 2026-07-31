import {
  extractOfficialGazetteEditionNumber,
  isOfficialGazetteCompleteListIntent,
  normalizeOfficialGazetteDateFromQuestion,
} from "@/lib/governance/chat/official-gazette-query";
import {
  compareOfficialGazetteRows,
  getOfficialGazetteDocumentMetadata,
  getOfficialGazetteDocumentSortValue,
  type OfficialGazetteContextChunkRow,
} from "@/lib/governance/chat/official-gazette-metadata";

export function selectCompleteOfficialGazetteRowsForQuestion(
  rows: OfficialGazetteContextChunkRow[],
  question: string,
) {
  const editionNumber = extractOfficialGazetteEditionNumber(question);
  const publicationDate = normalizeOfficialGazetteDateFromQuestion(question);
  const completeListIntent = isOfficialGazetteCompleteListIntent(question);

  if (!editionNumber && !publicationDate && !completeListIntent) {
    return null;
  }

  const rowsByDocumentId = new Map<string, OfficialGazetteContextChunkRow[]>();

  for (const row of rows) {
    const documentRows = rowsByDocumentId.get(row.document_id) ?? [];

    documentRows.push(row);
    rowsByDocumentId.set(row.document_id, documentRows);
  }

  const documentGroups = Array.from(rowsByDocumentId.values()).map((documentRows) =>
    [...documentRows].sort(compareOfficialGazetteRows),
  );

  const matchedGroups = documentGroups.filter((documentRows) => {
    const metadata = getOfficialGazetteDocumentMetadata(documentRows[0]);

    if (editionNumber && Number(metadata.editionNumber) !== editionNumber) {
      return false;
    }

    if (publicationDate && metadata.publicationDate !== publicationDate) {
      return false;
    }

    return true;
  });

  if (matchedGroups.length > 0) {
    return matchedGroups
      .sort((a, b) => getOfficialGazetteDocumentSortValue(b) - getOfficialGazetteDocumentSortValue(a))
      .flat();
  }

  if (!editionNumber && !publicationDate && completeListIntent && documentGroups.length > 0) {
    return documentGroups.sort(
      (a, b) => getOfficialGazetteDocumentSortValue(b) - getOfficialGazetteDocumentSortValue(a),
    )[0];
  }

  return null;
}
