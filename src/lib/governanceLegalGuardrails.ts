// src/lib/governanceLegalGuardrails.ts
import {
  GOVERNANCE_CRITICAL_KNOWLEDGE,
  type GovernanceCriticalKnowledgeItem,
} from "@/lib/governanceCriticalKnowledge";

function stripAccents(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalize(value: string) {
  return stripAccents(value).toLowerCase();
}

function matchesKnowledgeItem(
  normalizedUserText: string,
  item: GovernanceCriticalKnowledgeItem,
) {
  return item.keywords.some((keyword) =>
    normalizedUserText.includes(normalize(keyword)),
  );
}

export function findGovernanceCriticalKnowledge(userText: string) {
  const q = normalize(userText);

  if (!q.trim()) {
    return [];
  }

  return GOVERNANCE_CRITICAL_KNOWLEDGE.filter((item) =>
    matchesKnowledgeItem(q, item),
  );
}

export function buildGovernanceLegalGuardrails(userText: string) {
  const matches = findGovernanceCriticalKnowledge(userText);

  if (matches.length === 0) {
    return "";
  }

  const criticalMatches = matches.filter((item) => item.priority === "critical");
  const highMatches = matches.filter((item) => item.priority === "high");

  const selectedRules = [...criticalMatches, ...highMatches]
    .slice(0, 5)
    .map((item, index) =>
      [
        `REGRA ${index + 1}: ${item.title}`,
        `Prioridade: ${item.priority === "critical" ? "CRÍTICA" : "ALTA"}`,
        item.rule.trim(),
      ].join("\n"),
    );

  return [
    "GUARDRAILS JURÍDICOS CRÍTICOS",
    "",
    "As regras abaixo foram acionadas porque a pergunta envolve tema jurídico, contábil, fiscal, licitatório ou de controle com risco de erro material.",
    "Use essas regras como referência obrigatória na resposta.",
    "Preserve o tom consultivo, didático e conversacional do Publ.IA.",
    "Não transforme a resposta em texto seco.",
    "Não recomende prática vedada.",
    "Não invente artigo, inciso, prazo, percentual ou limite.",
    "",
    "REGRA DE UTILIDADE ADMINISTRATIVA",
    "Quando a pergunta pedir valor, limite, prazo, percentual, requisito objetivo ou documento, responda primeiro com o dado solicitado, de forma direta.",
    "Se a Base Normativa Oficial trouxer o valor, prazo, percentual ou limite, use esse dado expressamente na primeira parte da resposta.",
    "Não substitua a resposta por frases como 'consulte a legislação', 'verifique a norma vigente' ou 'procure o órgão competente' quando houver dado suficiente no contexto.",
    "A validação em fonte oficial, norma local ou área técnica deve aparecer como cautela posterior, não como substituta da resposta.",
    "Quando houver dúvida sobre dado volátil ou norma local e não houver dado suficiente no contexto, diga isso em uma frase curta e peça a fonte necessária, sem enrolar.",
    "",
    ...selectedRules,
  ].join("\n");
}
