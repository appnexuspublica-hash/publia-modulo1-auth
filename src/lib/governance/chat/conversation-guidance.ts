import { clampText } from "@/lib/governance/chat/pdf-context";
import type { ConversationRelation } from "@/lib/governance/chat/history";
import type { GovernanceResponseMode } from "@/types/governance";

function normalizeAdministrativeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isObjectiveAdministrativeQuestion(userText: string) {
  const q = normalizeAdministrativeText(userText);

  if (!q.trim()) {
    return false;
  }

  const asksObjectiveData =
    /\b(qual|quais|quanto|quantos|quando|prazo|valor|limite|teto|percentual|porcentagem|requisito|documento|documentos|competencia|competência)\b/.test(q);

  const hasAdministrativeTheme =
    /\b(dispensa|licitacao|licitação|contrato|contratacao|contratação|ata|carona|reajuste|repactuacao|repactuação|sancao|sanção|lrf|prudencial|pessoal|irrf|tributo|tributario|tributário|contabil|contábil|orcamentaria|orçamentária|estagio|estágio|diaria|diária|empenho|liquidacao|liquidação|pagamento|lei|decreto|portaria|municipio|município|executivo|legislativo)\b/.test(q);

  return asksObjectiveData && hasAdministrativeTheme;
}

export function buildConversationRelationInstruction(params: {
  relation: ConversationRelation;
  previousUserQuestion: string;
  currentUserQuestion: string;
}) {
  const previousQuestion = clampText(params.previousUserQuestion, 600);
  const currentQuestion = clampText(params.currentUserQuestion, 600);

  const base = [
    "CLASSIFICAÇÃO DA RELAÇÃO ENTRE PERGUNTAS",
    "",
    `Resultado: ${params.relation}.`,
    previousQuestion ? `Pergunta anterior do usuário: ${previousQuestion}` : "Pergunta anterior do usuário: não identificada.",
    `Pergunta atual do usuário: ${currentQuestion}`,
    "",
    "A pergunta atual continua sendo a prioridade absoluta da resposta.",
    "Use esta classificação para controlar continuidade, repetição e tamanho da resposta.",
    "",
  ];

  if (params.relation === "CONTINUA_COMPLEMENTAR") {
    return [
      ...base,
      "REGRA PARA CONTINUIDADE COMPLEMENTAR",
      "- A pergunta atual é um complemento do tema anterior, geralmente pedindo medição, acompanhamento, indicadores, metas, verificação ou próximos controles.",
      "- Responda apenas ao aspecto específico perguntado agora.",
      "- Não redefina conceitos já explicados.",
      "- Não reapresente contexto amplo.",
      "- Não recrie listas gerais já apresentadas em respostas anteriores.",
      "- Não escreva uma nova consultoria completa.",
      "- Comece diretamente com a resposta prática.",
      "- A resposta deve ser completa o suficiente para resolver o pedido atual, sem cortes artificiais.",
      "- Não aplique limite artificial de palavras. Responda com o detalhamento necessário para resolver o pedido.",
      "- Use no máximo 6 itens principais.",
      "- Se a pergunta pedir indicadores, métricas, monitoramento ou avaliação, entregue os indicadores diretamente no início.",
      "- Não inclua Base legal ou Referências oficiais nesse tipo de follow-up, salvo pedido expresso ou risco jurídico direto.",
      "- Feche com uma orientação prática de aplicação para o gestor em uma única frase.",
    ].join("\n");
  }

  if (params.relation === "CONTINUA") {
    return [
      ...base,
      "REGRA PARA CONTINUIDADE FORTE",
      "- A pergunta atual aprofunda ou desdobra o tema anterior.",
      "- Não redefina conceitos já explicados, salvo se for indispensável em uma frase curta.",
      "- Não repita listas gerais, fundamentos amplos ou blocos já apresentados.",
      "- Comece conectando em no máximo 1 frase e avance para o próximo passo prático.",
      "- A resposta deve ser mais complementar e mais enxuta que uma resposta inicial.",
      "- Foque no novo recorte pedido pelo usuário.",
    ].join("\n");
  }

  if (params.relation === "RELACIONA") {
    return [
      ...base,
      "REGRA PARA TEMA RELACIONADO",
      "- A pergunta atual tem relação com a trajetória da conversa, mas não é o mesmo tema.",
      "- Faça uma ponte curta, de no máximo 1 frase, se isso ajudar.",
      "- Depois responda o novo foco normalmente.",
      "- Não recapitule os temas anteriores.",
      "- Não transforme a resposta em plano integrado salvo pedido expresso do usuário.",
    ].join("\n");
  }

  if (params.relation === "ROMPE") {
    return [
      ...base,
      "REGRA PARA RUPTURA DE TEMA",
      "- A pergunta atual iniciou um novo assunto.",
      "- Não mencione, não recapitule e não responda temas anteriores.",
      "- Ignore a trajetória anterior, salvo se o usuário pedir comparação ou relação expressamente.",
      "- Responda exclusivamente ao novo assunto.",
    ].join("\n");
  }

  return [
    ...base,
    "REGRA PARA PRIMEIRA PERGUNTA OU CONTEXTO INICIAL",
    "- Responda normalmente, sem tentar conectar com histórico inexistente.",
  ].join("\n");
}

export function buildForcedExecutiveFollowUpInstruction(params: {
  relation: ConversationRelation;
  mode: GovernanceResponseMode;
}) {
  if (params.mode !== "objective" || params.relation !== "CONTINUA_COMPLEMENTAR") {
    return "";
  }

  return [
    "PRIORIDADE MÁXIMA — FOLLOW-UP EXECUTIVO",
    "",
    "Esta instrução prevalece sobre o estilo consultivo padrão do Governança.",
    "A pergunta atual é complementar. Portanto, responda como acompanhamento executivo, não como nova explicação completa.",
    "",
    "FORMATO OBRIGATÓRIO DA RESPOSTA:",
    "",
    "Resposta direta:",
    "[uma frase curta]",
    "",
    "Indicadores/Métricas principais:",
    "- [item objetivo]",
    "- [item objetivo]",
    "- [item objetivo]",
    "- [item objetivo]",
    "- [item objetivo]",
    "",
    "Como acompanhar:",
    "- [ação objetiva]",
    "- [ação objetiva]",
    "",
    "PROIBIDO NESTE CASO:",
    "- abrir com contextualização ampla;",
    "- repetir conceitos já explicados;",
    "- criar seções novas além das três acima;",
    "- escrever como artigo, parecer, plano completo ou mini consultoria;",
    "- incluir Base legal ou Referências oficiais, salvo pedido expresso ou risco jurídico direto;",
    "- ultrapassar 180 palavras.",
  ].join("\n");
}
