import {
  extractOfficialGazetteExactActReference,
  normalizeOfficialGazetteSearchText,
} from "@/lib/governance/chat/official-gazette-query";
import type { OfficialGazetteContextChunkRow } from "@/lib/governance/chat/official-gazette-metadata";

export async function loadExactOfficialGazetteActRows(params: {
  client: any;
  organizationId: string;
  question: string;
}) {
  const exactReference = extractOfficialGazetteExactActReference(params.question);

  if (!exactReference) {
    return [] as OfficialGazetteContextChunkRow[];
  }

  /*
   * Busca ampla pelo ano e validação estrita em memória.
   *
   * Não usamos somente ILIKE "%012/2026%" porque PDFs podem extrair o mesmo
   * cabeçalho como "012 / 2026", "12/2026", "Nº 012 / 2026" ou com quebra
   * de linha entre o número e o ano.
   */
  const { data, error } = await params.client
    .from("governance_official_gazette_chunks")
    .select(
      `
        document_id,
        organization_id,
        page_number,
        section_type,
        title,
        content,
        governance_official_gazette_documents(
          edition_number,
          publication_date,
          public_url,
          pdf_url,
          source_page_url
        )
      `,
    )
    .eq("organization_id", params.organizationId)
    .or(`title.ilike.%${exactReference.year}%,content.ilike.%${exactReference.year}%`)
    .order("document_id", { ascending: false })
    .order("page_number", { ascending: true, nullsFirst: false })
    .limit(5000);

  if (error) {
    console.warn(
      "[governance/chat] Falha na busca exata de ato do Diário Oficial:",
      error,
    );
    return [] as OfficialGazetteContextChunkRow[];
  }

  const actType = normalizeOfficialGazetteSearchText(exactReference.actType);
  const escapedNumber = exactReference.number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedYear = exactReference.year.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exactActPattern = new RegExp(
    `\\b${actType}(?:\\s+municipal)?(?:\\s+n)?\\s*0*${escapedNumber}\\s*[/\\-]\\s*${escapedYear}\\b`,
    "i",
  );

  return ((data ?? []) as OfficialGazetteContextChunkRow[])
    .filter((row) => String(row.content ?? "").trim().length > 0)
    .filter((row) => {
      const searchable = normalizeOfficialGazetteSearchText(
        `${row.title ?? ""}\n${row.content ?? ""}`,
      );

      return exactActPattern.test(searchable);
    });
}

