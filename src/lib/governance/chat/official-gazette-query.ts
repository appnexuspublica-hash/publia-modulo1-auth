const OFFICIAL_GAZETTE_TRIGGER_WORDS = [
  "diario oficial",
  "diário oficial",
  "ato",
  "atos",
  "decreto",
  "portaria",
  "resolucao",
  "resolução",
  "dispensa",
  "licitacao",
  "licitação",
  "inexigibilidade",
  "edital",
  "extrato",
  "contrato",
  "publicado",
  "publicada",
  "publicadas",
  "publicados",
  "suplementacao",
  "suplementação",
];

const OFFICIAL_GAZETTE_STOPWORDS = new Set([
  "sobre",
  "para",
  "com",
  "sem",
  "que",
  "qual",
  "quais",
  "quando",
  "quanto",
  "quantas",
  "quantos",
  "houve",
  "existe",
  "existem",
  "foram",
  "publicada",
  "publicadas",
  "publicado",
  "publicados",
  "diario",
  "diário",
  "oficial",
  "atos",
  "ato",
  "tem",
  "das",
  "dos",
  "uma",
  "uns",
  "por",
  "entre",
  "este",
  "esta",
  "esse",
  "essa",
  "municipio",
  "município",
]);

export type OfficialGazetteExactActReference = {
  actType: "decreto" | "portaria" | "resolucao" | "edital";
  number: string;
  year: string;
  variants: string[];
};

export function normalizeOfficialGazetteSearchText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasOfficialGazetteTrigger(question: string) {
  const normalizedQuestion = normalizeOfficialGazetteSearchText(question);

  return OFFICIAL_GAZETTE_TRIGGER_WORDS.some((word) =>
    normalizedQuestion.includes(normalizeOfficialGazetteSearchText(word)),
  );
}

export function extractOfficialGazetteSearchTerms(question: string) {
  const normalizedQuestion = normalizeOfficialGazetteSearchText(question);

  const terms = normalizedQuestion
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length >= 4)
    .filter((term) => !OFFICIAL_GAZETTE_STOPWORDS.has(term));

  const mappedTerms: string[] = [];

  if (normalizedQuestion.includes("decreto")) mappedTerms.push("decreto");
  if (normalizedQuestion.includes("portaria")) mappedTerms.push("portaria");
  if (normalizedQuestion.includes("resolucao")) mappedTerms.push("resolucao");
  if (normalizedQuestion.includes("dispensa")) mappedTerms.push("dispensa", "licitacao");
  if (normalizedQuestion.includes("licitacao")) mappedTerms.push("licitacao");
  if (normalizedQuestion.includes("suplementacao")) mappedTerms.push("suplementacao", "credito", "orcamento");
  if (normalizedQuestion.includes("junho")) mappedTerms.push("junho", "06/");

  return Array.from(new Set([...mappedTerms, ...terms])).slice(0, 20);
}

export function extractOfficialGazetteExactActReference(
  question: string,
): OfficialGazetteExactActReference | null {
  const normalizedQuestion = normalizeOfficialGazetteSearchText(question);
  const match = normalizedQuestion.match(
    /\b(decreto|portaria|resolucao|edital)\s+(?:n\s*)?0*(\d{1,6})\/(20\d{2})\b/i,
  );

  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  const actType = match[1] as OfficialGazetteExactActReference["actType"];
  const numericNumber = Number(match[2]);

  if (!Number.isFinite(numericNumber)) {
    return null;
  }

  const year = match[3];
  const plainNumber = String(numericNumber);
  const padded3 = plainNumber.padStart(3, "0");
  const padded4 = plainNumber.padStart(4, "0");

  return {
    actType,
    number: plainNumber,
    year,
    variants: Array.from(
      new Set([
        `${plainNumber}/${year}`,
        `${padded3}/${year}`,
        `${padded4}/${year}`,
      ]),
    ),
  };
}

export function isMunicipalAnchoredRecoveryQuery(question: string) {
  const normalized = normalizeOfficialGazetteSearchText(question);

  return /\b(diario oficial|portaria|decreto|resolucao|edital|codigo tributario|lei organica|plano diretor|estatuto dos servidores|documento institucional)\b/.test(
    normalized,
  );
}

export function extractOfficialGazetteEditionNumber(question: string) {
  const normalizedQuestion = normalizeOfficialGazetteSearchText(question);

  const editionMatch =
    normalizedQuestion.match(/\bedicao\s+(?:do\s+diario\s+oficial\s+)?(\d{1,8})\b/i) ??
    normalizedQuestion.match(/\bdiario\s+oficial\s+(?:n\s*)?(\d{1,8})\b/i) ??
    normalizedQuestion.match(/\bdiario\s+(?:n\s*)?(\d{1,8})\b/i);

  if (!editionMatch?.[1]) {
    return null;
  }

  const editionNumber = Number(editionMatch[1]);

  return Number.isFinite(editionNumber) ? editionNumber : null;
}

export function normalizeOfficialGazetteDateFromQuestion(question: string) {
  const text = String(question ?? "");

  const brDateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);

  if (brDateMatch) {
    const day = brDateMatch[1].padStart(2, "0");
    const month = brDateMatch[2].padStart(2, "0");
    const year = brDateMatch[3];

    return `${year}-${month}-${day}`;
  }

  const isoDateMatch = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);

  if (isoDateMatch) {
    const year = isoDateMatch[1];
    const month = isoDateMatch[2].padStart(2, "0");
    const day = isoDateMatch[3].padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return null;
}

export function isOfficialGazetteCompleteListIntent(question: string) {
  const normalizedQuestion = normalizeOfficialGazetteSearchText(question);

  const mentionsGazette =
    normalizedQuestion.includes("diario") ||
    normalizedQuestion.includes("edicao") ||
    normalizedQuestion.includes("publicacao") ||
    normalizedQuestion.includes("publicacoes") ||
    normalizedQuestion.includes("atos") ||
    normalizedQuestion.includes("ato");

  const asksCount =
    /\b(quantos|quantas|quantidade|total|numero|número)\b/i.test(normalizedQuestion) &&
    /\b(atos|ato|publicacoes|publicacao|publicados|publicadas)\b/i.test(normalizedQuestion);

  const asksList =
    /\b(liste|listar|lista|mostre|mostrar|relacione|descreva|descrever|quais)\b/i.test(
      normalizedQuestion,
    ) &&
    /\b(atos|ato|publicacoes|publicacao|publicados|publicadas)\b/i.test(normalizedQuestion);

  return mentionsGazette && (asksCount || asksList || normalizedQuestion.includes("todos os atos"));
}
