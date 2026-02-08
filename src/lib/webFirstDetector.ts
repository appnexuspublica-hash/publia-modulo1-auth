function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function shouldForceWebFirst(userText: string): boolean {
  const raw = (userText ?? "").trim();
  if (!raw) return false;

  const t = stripAccents(raw).toLowerCase();

  // 1) Gatilhos “normativos sensíveis”
  const triggers = [
    "valor", "valores", "limite", "teto", "faixa",
    "percentual", "porcentagem", "aliquota", "indice",
    "atualizado", "vigente", "hoje", "ultima atualizacao", "novo decreto",
    "prazo", "prazos", "quantos dias", "dias", "data limite",
    "art.", "artigo", "inciso", "paragrafo",
    "lei", "decreto", "portaria", "instrucao normativa", "in ",
    "dispensa", "inexigibilidade", "aditivo", "reajuste", "repactuacao",
    "14.133", "14133", "licitacao", "contrato administrativo",
  ];

  const hit = triggers.some((k) => t.includes(k));

  // 2) Sinais numéricos típicos (mesmo sem palavras-chave)
  const numericSignals =
    /\br\$\s*\d/i.test(t) ||
    /\b\d+\s*%\b/.test(t) ||
    /\b\d+\s*dias?\b/.test(t) ||
    /\b\d{1,3}\.\d{3}\b/.test(t);

  // 3) Pergunta curta do tipo “qual o valor/limite…”
  const shortQuestion = t.length <= 80 && (t.startsWith("qual") || t.startsWith("quais") || t.includes("?"));

  return hit || numericSignals || shortQuestion;
}
