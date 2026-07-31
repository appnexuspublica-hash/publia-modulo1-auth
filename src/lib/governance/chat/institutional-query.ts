import type { InstitutionalDocumentContextRow } from "@/lib/governance/chat/institutional-documents";

const INSTITUTIONAL_STOP_WORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "e",
  "em",
  "de",
  "da",
  "das",
  "do",
  "dos",
  "para",
  "por",
  "com",
  "sem",
  "sobre",
  "qual",
  "quais",
  "onde",
  "posso",
  "pode",
  "tem",
  "possui",
  "existe",
  "existem",
  "municipio",
  "municipal",
  "municipais",
  "prefeitura",
  "santana",
  "itarare",
  "pr",
  "publicado",
  "publicada",
  "consultar",
  "encontrar",
  "localizar",
]);

export function normalizeInstitutionalSearchText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getInstitutionalSearchTokens(value: string) {
  return normalizeInstitutionalSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !INSTITUTIONAL_STOP_WORDS.has(token));
}

export function getInstitutionalQueryPhrases(question: string) {
  const q = normalizeInstitutionalSearchText(question);
  const phrases: string[] = [];

  const phraseRules = [
    "ata de posse",
    "gestao 2025 2028",
    "plano diretor",
    "lei organica",
    "codigo tributario",
    "sistema tributario",
    "estatuto dos servidores",
    "estatuto servidor",
    "servidores municipais",
    "portal transparencia",
    "diario oficial",
    "fontes oficiais",
  ];

  for (const phrase of phraseRules) {
    if (q.includes(phrase)) {
      phrases.push(phrase);
    }
  }

  return phrases;
}

export function isLocalOfficeHolderQuestion(question: string) {
  const q = normalizeInstitutionalSearchText(question);

  if (!q) {
    return false;
  }

  const asksPerson =
    /\b(quem|qual|quais|nome|nomes|identifique|informe)\b/.test(q);

  const hasLocalOffice =
    /\b(prefeito|prefeita|vice prefeito|vice prefeita|viceprefeito|viceprefeita|secretario|secretaria|presidente da camara|vereador|vereadora|tomou posse|posse|empossado|empossada|mandato)\b/.test(q);

  return asksPerson && hasLocalOffice;
}

export function scoreLocalOfficeHolderDocument(
  document: InstitutionalDocumentContextRow,
  question: string,
) {
  if (!isLocalOfficeHolderQuestion(question)) {
    return 0;
  }

  const q = normalizeInstitutionalSearchText(question);
  const title = normalizeInstitutionalSearchText(document.title);
  const type = normalizeInstitutionalSearchText(document.document_type);
  const text = normalizeInstitutionalSearchText(
    String(document.extracted_text ?? "").slice(0, 60000),
  );

  let score = 0;

  if (title.includes("ata") && title.includes("posse")) score += 180;
  if (title.includes("posse")) score += 120;
  if (title.includes("gestao") && /\b2025\b/.test(title)) score += 90;
  if (type.includes("ata")) score += 80;

  if (/\b(prefeito|prefeita)\b/.test(q) && /\b(prefeito|prefeita)\b/.test(text)) {
    score += 120;
  }

  if (/\bvice\b/.test(q) && /\bvice prefeito|vice prefeita|viceprefeito|viceprefeita\b/.test(text)) {
    score += 130;
  }

  if (/\b(posse|tomou posse|empossado|empossada)\b/.test(q) && /\b(posse|empossad[oa]s?|mandato)\b/.test(text)) {
    score += 100;
  }

  if (/\b2025\b/.test(q) && /\b2025\b/.test(text)) {
    score += 45;
  }

  if (/\b2028\b/.test(q) && /\b2028\b/.test(text)) {
    score += 35;
  }

  return score;
}


export function isMunicipalCreationLawQuestion(question: string) {
  const q = normalizeInstitutionalSearchText(question);

  return (
    /\blei\b/.test(q) &&
    (q.includes("cria") || q.includes("criacao") || q.includes("criação")) &&
    (q.includes("municipio") || q.includes("município"))
  );
}

export function isAdministrativeStructureQuestion(question: string) {
  const q = normalizeInstitutionalSearchText(question);

  return (
    (q.includes("estrutura") && (q.includes("administrativa") || q.includes("administracao"))) ||
    q.includes("organograma") ||
    (q.includes("secretaria") && q.includes("municipal"))
  );
}

export function isCareerProgressionQuestion(question: string) {
  const q = normalizeInstitutionalSearchText(question);

  return (
    q.includes("progressao") ||
    q.includes("progressão") ||
    q.includes("intersticio") ||
    q.includes("interstício") ||
    q.includes("carreira") ||
    q.includes("referencia") ||
    q.includes("referência")
  );
}

function isCreationLawDocument(document: InstitutionalDocumentContextRow) {
  const title = normalizeInstitutionalSearchText(document.title);
  const type = normalizeInstitutionalSearchText(document.document_type);
  const text = normalizeInstitutionalSearchText(String(document.extracted_text ?? "").slice(0, 5000));

  return (
    title.includes("lei estadual") &&
    (title.includes("cria") || title.includes("criacao")) &&
    (title.includes("municipio") || title.includes("município") || text.includes("santana do itarare"))
  ) || (
    type.includes("lei") &&
    text.includes("santana do itarare") &&
    (text.includes("cria") || text.includes("criado") || text.includes("criacao"))
  );
}

function isAdministrativeStructureDocument(document: InstitutionalDocumentContextRow) {
  const title = normalizeInstitutionalSearchText(document.title);
  const type = normalizeInstitutionalSearchText(document.document_type);
  const text = normalizeInstitutionalSearchText(String(document.extracted_text ?? "").slice(0, 15000));

  const positive =
    title.includes("estrutura administrativa") ||
    title.includes("administrativa da prefeitura") ||
    text.includes("estrutura administrativa") ||
    text.includes("administracao direta") ||
    text.includes("administração direta");

  const negative =
    title.includes("codigo tributario") ||
    title.includes("código tributário") ||
    title.includes("plano de cargos") ||
    title.includes("carreiras") ||
    title.includes("vencimentos") ||
    title.includes("plano diretor") ||
    title.includes("lei organica") ||
    title.includes("lei orgânica") ||
    type.includes("contrato");

  return positive && !negative;
}

function isCareerProgressionDocument(document: InstitutionalDocumentContextRow) {
  const title = normalizeInstitutionalSearchText(document.title);
  const text = normalizeInstitutionalSearchText(String(document.extracted_text ?? "").slice(0, 15000));

  const positive =
    title.includes("plano de cargos") ||
    title.includes("carreira") ||
    title.includes("carreiras") ||
    title.includes("vencimentos") ||
    title.includes("estatuto") ||
    text.includes("progressao horizontal") ||
    text.includes("progressão horizontal");

  const negative =
    title.includes("lei estadual") && (title.includes("cria") || title.includes("criacao")) ||
    title.includes("plano diretor") ||
    title.includes("codigo tributario") ||
    title.includes("estrutura administrativa");

  return positive && !negative;
}

export function getInstitutionalQuestionGuard(question: string) {
  if (isMunicipalCreationLawQuestion(question)) {
    return {
      kind: "creation-law",
      maxDocuments: 1,
      accepts: isCreationLawDocument,
    };
  }

  if (isAdministrativeStructureQuestion(question)) {
    return {
      kind: "administrative-structure",
      maxDocuments: 1,
      accepts: isAdministrativeStructureDocument,
    };
  }

  if (isCareerProgressionQuestion(question)) {
    return {
      kind: "career-progression",
      maxDocuments: 2,
      accepts: isCareerProgressionDocument,
    };
  }

  return null;
}

export function getInstitutionalDocumentPriorityBoost(
  document: InstitutionalDocumentContextRow,
  question: string,
) {
  if (isMunicipalCreationLawQuestion(question) && isCreationLawDocument(document)) {
    return 240;
  }

  if (isAdministrativeStructureQuestion(question) && isAdministrativeStructureDocument(document)) {
    return 220;
  }

  if (isCareerProgressionQuestion(question) && isCareerProgressionDocument(document)) {
    return 180;
  }

  return 0;
}
