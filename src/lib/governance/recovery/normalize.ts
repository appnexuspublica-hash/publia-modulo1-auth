const STOP_WORDS = new Set([
  "a","ao","aos","as","com","da","das","de","do","dos","e","em","entre","na",
  "nas","no","nos","o","os","ou","para","pela","pelas","pelo","pelos","por",
  "que","se","sem","ser","um","uma","uns","umas"
]);

export function normalizeRecoveryText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°ª]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getRecoveryTokens(value: unknown) {
  return Array.from(new Set(
    normalizeRecoveryText(value)
      .split(" ")
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
  ));
}

export function scoreLexicalEvidence(question: string, title: string, content: string) {
  const q = normalizeRecoveryText(question);
  const titleText = normalizeRecoveryText(title);
  const bodyText = normalizeRecoveryText(content);
  const tokens = getRecoveryTokens(q);

  let score = 0;
  for (const token of tokens) {
    if (titleText.includes(token)) score += 7;
    if (bodyText.includes(token)) score += 2;
  }

  if (q && titleText.includes(q)) score += 24;
  if (q && bodyText.includes(q)) score += 12;

  return score;
}
