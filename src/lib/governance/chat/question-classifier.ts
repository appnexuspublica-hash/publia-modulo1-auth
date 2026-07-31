// src/lib/governance/chat/question-classifier.ts

export type GovernanceQuestionIntent =
  | "general"
  | "exact_fact"
  | "specific_document";

export type GovernanceQuestionClassification = {
  intent: GovernanceQuestionIntent;
  reason: string;
};

const SPECIFIC_DOCUMENT_ACTION_PATTERN =
  /\b(resuma|resumir|resumo|sintetize|sintetizar|explique|análise|analise|analisar|conteúdo|teor|dispõe|estabelece)\b/i;

const SPECIFIC_DOCUMENT_TYPE_PATTERN =
  /\b(lei(?:\s+complementar)?|decreto|portaria|resolução|instrução\s+normativa|edital|acórdão|ato|norma)\b/i;

const SPECIFIC_DOCUMENT_IDENTIFIER_PATTERN =
  /\b(?:n[º°o.]?|número)\s*\d+[\w./-]*|\b\d{1,6}\s*\/\s*\d{2,4}\b/i;


const EXACT_FACT_PATTERN =
  /^(?:quem\s+(?:é|e|foi)|qual\s+(?:é|e|foi|o|a)|qual\s+lei|qual\s+número|qual\s+numero|quando\s+(?:foi|é|e)|onde\s+(?:fica|está|esta)|quanto\s+(?:é|e|custa)|nome\s+do|nome\s+da)\b/i;

const EXPLANATORY_REQUEST_PATTERN =
  /\b(explique|detalhe|analise|compare|justifique|como funciona|passo a passo|quais|liste|enumere)\b/i;

/**
 * Classificação inicial e conservadora da intenção da pergunta.
 *
 * Nesta primeira etapa, a classificação é apenas observacional:
 * ela não altera Recovery, Web, prompts ou fontes.
 */
export function classifyGovernanceQuestion(
  question: string,
): GovernanceQuestionClassification {
  const normalizedQuestion = question.trim();

  const hasDocumentType =
    SPECIFIC_DOCUMENT_TYPE_PATTERN.test(normalizedQuestion);
  const hasDocumentIdentifier =
    SPECIFIC_DOCUMENT_IDENTIFIER_PATTERN.test(normalizedQuestion);
  const hasDocumentAction =
    SPECIFIC_DOCUMENT_ACTION_PATTERN.test(normalizedQuestion);

  if (hasDocumentType && hasDocumentIdentifier && hasDocumentAction) {
    return {
      intent: "specific_document",
      reason: "A pergunta contém ação, tipo e identificador de documento.",
    };
  }

  const compactQuestion = normalizedQuestion.replace(/\s+/g, " ").trim();
  const asksExactFact =
    compactQuestion.length <= 180 &&
    EXACT_FACT_PATTERN.test(compactQuestion) &&
    !EXPLANATORY_REQUEST_PATTERN.test(compactQuestion);

  if (asksExactFact) {
    return {
      intent: "exact_fact",
      reason:
        "A pergunta solicita um dado factual específico e não pede desenvolvimento.",
    };
  }

  return {
    intent: "general",
    reason:
      "Não foram encontrados sinais suficientes de documento específico.",
  };
}
