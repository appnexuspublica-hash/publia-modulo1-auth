const STOP_WORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas",
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
  "por", "para", "com", "sem", "sobre", "entre", "ate", "até",
  "que", "qual", "quais", "como", "quando", "quanto", "quantos", "quantas",
  "e", "ou", "se", "sua", "seu", "suas", "seus", "essa", "esse", "esta", "este",
  "municipio", "município", "municipal", "santana", "itarare", "itararé",
  "prefeitura", "governanca", "governança", "lei", "leis"
]);

const SYNONYMS: Record<string, string[]> = {
  "progressao": ["progressão", "progressao", "promoção", "promocao", "carreira", "pccs", "vencimento", "classe", "nivel", "nível"],
  "horizontal": ["horizontal"],
  "estrutura": ["estrutura", "organograma", "organizacional", "administrativa", "administrativo", "secretaria", "secretarias", "departamento", "departamentos"],
  "cria": ["cria", "criacao", "criação", "emancipacao", "emancipação", "fundacao", "fundação"],
  "organica": ["organica", "orgânica"],
  "servidor": ["servidor", "servidores", "funcionario", "funcionário", "funcionarios", "funcionários", "estatuto"],
  "tributo": ["tributo", "tributario", "tributário", "iptu", "iss", "taxa", "imposto"],
  "diario": ["diario", "diário", "publicacao", "publicação", "portaria", "decreto", "ato", "edital", "nomeacao", "nomeação"],
};

export function normalizeGovernanceText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getGovernanceSearchTokens(question: string): string[] {
  const normalized = normalizeGovernanceText(question);
  const rawTokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

  const expanded = new Set<string>(rawTokens);

  for (const token of rawTokens) {
    for (const [canonical, variants] of Object.entries(SYNONYMS)) {
      if (token === canonical || variants.includes(token)) {
        expanded.add(canonical);
        for (const variant of variants) {
          expanded.add(normalizeGovernanceText(variant));
        }
      }
    }
  }

  return Array.from(expanded).filter((token) => token.length >= 3);
}

export function getExactQuestionPhrases(question: string): string[] {
  const normalized = normalizeGovernanceText(question);
  const phrases = new Set<string>();

  const knownPhrases = [
    "progressao horizontal",
    "progressão horizontal",
    "estrutura administrativa",
    "lei organica",
    "lei orgânica",
    "lei de criacao",
    "lei de criação",
    "plano de cargos",
    "plano diretor",
    "estatuto dos servidores",
  ];

  for (const phrase of knownPhrases) {
    const normalizedPhrase = normalizeGovernanceText(phrase);
    if (normalized.includes(normalizedPhrase)) {
      phrases.add(normalizedPhrase);
    }
  }

  const tokens = normalized.split(" ").filter(Boolean);
  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const phrase = tokens.slice(index, index + size).join(" ");
      if (phrase.length >= 8 && !phrase.split(" ").every((token) => STOP_WORDS.has(token))) {
        phrases.add(phrase);
      }
    }
  }

  return Array.from(phrases);
}
