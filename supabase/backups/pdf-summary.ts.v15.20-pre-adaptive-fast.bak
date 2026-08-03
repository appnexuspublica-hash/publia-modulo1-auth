import type OpenAI from "openai";

const SUMMARY_SOURCE_CHUNK_CHARS = 70000;
const MAX_SUMMARY_SOURCE_CHARS_PER_PDF = 420000;
const SUMMARY_CONCURRENCY = 2;

type PdfSummaryChunk = {
  chunkIndex: number;
  text: string;
};

type BuildGovernancePdfSummaryParams = {
  openai: OpenAI;
  model: string;
  fileName: string;
  extractedText: string;
  signal?: AbortSignal;
};

export type GovernancePdfSummaryResult = {
  summaryText: string;
  sourceChars: number;
  processedChars: number;
  coverageComplete: boolean;
  warnings: string[];
};

function normalizeSummaryPdfText(text: string) {
  return String(text ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitTextForSummary(text: string): PdfSummaryChunk[] {
  const normalized = normalizeSummaryPdfText(text);

  if (!normalized) {
    return [];
  }

  const chunks: PdfSummaryChunk[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const hardEnd = Math.min(normalized.length, cursor + SUMMARY_SOURCE_CHUNK_CHARS);
    let end = hardEnd;

    if (hardEnd < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf("\n\n", hardEnd);
      const lineBreak = normalized.lastIndexOf("\n", hardEnd);
      const candidate = Math.max(paragraphBreak, lineBreak);

      if (candidate > cursor + Math.floor(SUMMARY_SOURCE_CHUNK_CHARS * 0.7)) {
        end = candidate;
      }
    }

    const chunkText = normalized.slice(cursor, end).trim();
    if (chunkText) {
      chunks.push({ chunkIndex: chunks.length, text: chunkText });
    }

    cursor = Math.max(end, cursor + 1);
  }

  return chunks;
}

async function summarizeSourceChunk(params: {
  openai: OpenAI;
  model: string;
  fileName: string;
  chunk: PdfSummaryChunk;
  chunkCount: number;
  signal?: AbortSignal;
}) {
  const response: any = await params.openai.responses.create(
    {
      model: params.model,
      instructions: [
        "Você está resumindo uma parte sequencial de um documento administrativo.",
        "Preserve títulos, capítulos, direitos, deveres, prazos, requisitos, exceções, penalidades e procedimentos que apareçam no texto.",
        "Não complete lacunas e não use conhecimento externo.",
        "Não escreva observações genéricas sobre acesso a trechos; apenas resuma fielmente esta parte.",
        "Produza texto compacto, estruturado e útil para uma consolidação posterior.",
      ].join("\n"),
      input: [
        `Documento: ${params.fileName}`,
        `Parte ${params.chunk.chunkIndex + 1} de ${params.chunkCount}`,
        "",
        params.chunk.text,
      ].join("\n"),
      temperature: 0.1,
      max_output_tokens: 1400,
    } as any,
    params.signal ? { signal: params.signal } : undefined,
  );

  return String(response.output_text ?? "").trim();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

export async function buildGovernancePdfHierarchicalSummary(
  params: BuildGovernancePdfSummaryParams,
): Promise<GovernancePdfSummaryResult> {
  const normalized = normalizeSummaryPdfText(params.extractedText);
  const sourceChars = normalized.length;
  const coverageComplete = sourceChars <= MAX_SUMMARY_SOURCE_CHARS_PER_PDF;
  const sourceToProcess = coverageComplete
    ? normalized
    : normalized.slice(0, MAX_SUMMARY_SOURCE_CHARS_PER_PDF);
  const chunks = splitTextForSummary(sourceToProcess);
  const warnings: string[] = [];

  if (!coverageComplete) {
    warnings.push(
      `O documento \"${params.fileName}\" excedeu o limite seguro de processamento integral; foram processados ${MAX_SUMMARY_SOURCE_CHARS_PER_PDF.toLocaleString("pt-BR")} de ${sourceChars.toLocaleString("pt-BR")} caracteres.`,
    );
  }

  if (chunks.length === 0) {
    return {
      summaryText: "",
      sourceChars,
      processedChars: 0,
      coverageComplete,
      warnings,
    };
  }

  const partialSummaries = await mapWithConcurrency(
    chunks,
    SUMMARY_CONCURRENCY,
    (chunk) =>
      summarizeSourceChunk({
        openai: params.openai,
        model: params.model,
        fileName: params.fileName,
        chunk,
        chunkCount: chunks.length,
        signal: params.signal,
      }),
  );

  const usablePartialSummaries = partialSummaries.filter(Boolean);

  if (usablePartialSummaries.length === 0) {
    return {
      summaryText: "",
      sourceChars,
      processedChars: sourceToProcess.length,
      coverageComplete,
      warnings: [...warnings, `Não foi possível consolidar o conteúdo de \"${params.fileName}\".`],
    };
  }

  if (usablePartialSummaries.length === 1) {
    return {
      summaryText: usablePartialSummaries[0],
      sourceChars,
      processedChars: sourceToProcess.length,
      coverageComplete,
      warnings,
    };
  }

  const consolidationResponse: any = await params.openai.responses.create(
    {
      model: params.model,
      instructions: [
        "Consolide resumos parciais sequenciais do mesmo documento em um único resumo abrangente.",
        "Elimine repetições, preserve a ordem lógica e destaque estrutura, direitos, deveres, prazos, requisitos, exceções, procedimentos e penalidades.",
        "Não invente informações e não use conhecimento externo.",
        "Não diga que teve acesso apenas a trechos: os resumos cobrem sequencialmente o conteúdo processado.",
        "Use títulos e listas somente quando melhorarem a leitura.",
      ].join("\n"),
      input: [
        `Documento: ${params.fileName}`,
        "",
        ...usablePartialSummaries.map(
          (summary, index) => `PARTE ${index + 1}\n${summary}`,
        ),
      ].join("\n\n---\n\n"),
      temperature: 0.1,
      max_output_tokens: 3200,
    } as any,
    params.signal ? { signal: params.signal } : undefined,
  );

  return {
    summaryText: String(consolidationResponse.output_text ?? "").trim(),
    sourceChars,
    processedChars: sourceToProcess.length,
    coverageComplete,
    warnings,
  };
}
