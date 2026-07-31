import type { GovernanceRecoveryResponsePolicy } from "@/lib/governance/recovery/types";

const PROVIDER_LABELS: Record<string, string> = {
  official_gazette: "Diário Oficial",
  institutional: "base institucional",
  legal: "catálogo jurídico",
  attachment: "anexos",
  web: "pesquisa web",
};

function buildDegradedRecoveryInstruction(
  policy: GovernanceRecoveryResponsePolicy,
): string {
  if (!policy.degraded || policy.unavailableProviders.length === 0) return "";

  const providers = policy.unavailableProviders
    .map((provider) => PROVIDER_LABELS[provider] ?? provider)
    .join(", ");

  return [
    "AVISO OBRIGATÓRIO — RECUPERAÇÃO PARCIAL",
    `As seguintes fontes falharam durante esta requisição: ${providers}.`,
    "Não trate falha técnica como prova de inexistência de documento ou informação.",
    "Use somente as evidências efetivamente presentes no contexto.",
    "Quando a fonte indisponível for necessária para sustentar a conclusão, informe de forma breve que a resposta está parcial e não faça afirmações categóricas sobre o conteúdo ausente.",
  ].join("\n");
}

export function buildUnifiedResponsePolicyInstruction(
  policy: GovernanceRecoveryResponsePolicy,
): string {
  let modeInstruction = "";

  if (policy.mode === "direct_document") {
    modeInstruction = [
      "POLÍTICA FINAL DE RESPOSTA — DOCUMENTO MUNICIPAL EXATO",
      "Esta política substitui qualquer formato consultivo ou modo Padrão definido anteriormente.",
      "Responda diretamente ao que foi perguntado, usando apenas a evidência municipal recuperada.",
      "Máximo de 140 palavras e no máximo 3 parágrafos curtos.",
      "Não use títulos numerados, Fundamentação, Entendimento atual, Aplicação ao Município ou Cuidados.",
      "Não acrescente práticas administrativas, interpretações gerais ou recomendações que não constem do documento.",
      "Informe edição e data somente quando esses metadados estiverem no contexto.",
    ].join("\n");
  } else if (policy.mode === "document_summary") {
    modeInstruction = [
      "POLÍTICA FINAL DE RESPOSTA — DOCUMENTO INSTITUCIONAL",
      "Esta política substitui qualquer formato consultivo ou modo Padrão definido anteriormente.",
      "Responda somente com base nos trechos do documento municipal recuperado.",
      "Máximo de 280 palavras. Use texto direto e, apenas se necessário, uma lista curta.",
      "Não use a estrutura fixa de cinco seções.",
      "Não cite códigos tributários, leis ou portais de outros municípios.",
      "Não complete lacunas com conhecimento geral. Diga claramente quando o trecho recuperado não for suficiente.",
    ].join("\n");
  } else if (policy.mode === "comparison") {
    modeInstruction = [
      "POLÍTICA FINAL DE RESPOSTA — COMPARAÇÃO DOCUMENTAL",
      "Compare apenas as duas evidências municipais presentes no contexto.",
      "Identifique a regra institucional, o ato do Diário e a relação concreta entre eles.",
      "Máximo de 350 palavras. Não transforme a comparação em parecer genérico.",
      "Não use fontes externas nem documentos de outros municípios.",
    ].join("\n");
  } else if (policy.mode === "insufficient_evidence") {
    modeInstruction = [
      "POLÍTICA FINAL DE RESPOSTA — EVIDÊNCIA INSUFICIENTE OU INDISPONÍVEL",
      "Esta política substitui qualquer formato consultivo ou modo Padrão definido anteriormente.",
      "Não produza comparação hipotética, fundamentação geral, parecer ou roteiro de análise.",
      `Motivo confirmado pelo backend: ${policy.reason}`,
      "Explique em no máximo 100 palavras que a evidência necessária não pôde ser confirmada.",
      "Diferencie claramente fonte consultada sem resultado de fonte que falhou durante a consulta.",
      "Informe objetivamente qual evidência foi encontrada e qual evidência ficou ausente ou indisponível.",
      "Não afirme que um documento não existe quando a fonte correspondente estiver indisponível.",
      "Não use títulos numerados e não ofereça conteúdo especulativo.",
    ].join("\n");
  }

  return [modeInstruction, buildDegradedRecoveryInstruction(policy)]
    .filter(Boolean)
    .join("\n\n");
}
