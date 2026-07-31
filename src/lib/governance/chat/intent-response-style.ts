import type { GovernanceQuestionIntent } from "@/lib/governance/chat/question-classifier";
import type { GovernanceResponseMode } from "@/types/governance";

export function buildGovernanceIntentResponseInstruction(params: {
  intent: GovernanceQuestionIntent;
  responseMode: GovernanceResponseMode;
}): string {
  const { intent, responseMode } = params;

  if (intent === "specific_document") {
    return [
      "POLÍTICA FINAL DE RESPOSTA — DOCUMENTO ESPECÍFICO",
      "Identifique o ato pelo tipo, número e ano já na primeira frase.",
      "Responda diretamente o que o documento dispõe, estabelece, altera ou regulamenta.",
      "Priorize o objeto, os efeitos principais, os órgãos ou pessoas alcançados e a vigência quando essas informações estiverem disponíveis.",
      "Não explique genericamente o que é uma lei, decreto, portaria ou resolução.",
      "Não complete lacunas com conhecimento presumido: quando um ponto não estiver sustentado pelo documento recuperado, declare a limitação de forma breve.",
      "Diferencie o conteúdo expresso do ato de inferências administrativas ou jurídicas.",
      "Não crie manualmente seção de fontes; o backend montará o rodapé estruturado.",
    ].join("\n");
  }

  if (intent === "exact_fact" && responseMode === "objective") {
    return [
      "POLÍTICA FINAL DE RESPOSTA — FATO OBJETIVO",
      "Responda o dado solicitado já na primeira frase, com nome, número, data, valor ou identificação exata.",
      "Depois acrescente somente o contexto indispensável para compreender ou qualificar a resposta.",
      "Não transforme a resposta em explicação geral, histórico, parecer ou roteiro de pesquisa.",
      "Quando houver referência oficial pré-resolvida, use o identificador exato e não diga que ele ainda precisa ser localizado.",
      "Inclua ressalva apenas quando houver incerteza real, possível alteração posterior ou limitação expressa das fontes.",
      "Não crie manualmente seção de fontes; o backend montará o rodapé estruturado.",
    ].join("\n");
  }

  if (intent !== "general" || responseMode !== "objective") {
    return "";
  }

  return [
    "POLÍTICA FINAL DE RESPOSTA — PERGUNTA GERAL",
    "Esta política substitui o formato consultivo padrão definido anteriormente.",
    "Responda diretamente como um assistente jurídico especializado em Administração Pública.",
    "Use linguagem clara, natural e didática, sem transformar a resposta em parecer, relatório, auditoria ou roteiro burocrático.",
    "Comece explicando o conceito solicitado em texto corrido.",
    "Use listas apenas quando ajudarem de fato a compreensão.",
    "Não use automaticamente as seções Resposta objetiva, Fundamentação, Entendimento atual, Aplicação ao Município ou Cuidados.",
    "Inclua fundamentação legal concisa quando houver norma consolidada diretamente pertinente ao tema.",
    "Mencione no corpo da resposta apenas as normas realmente úteis, para que o sistema monte a Base Legal com links oficiais.",
    "Não crie manualmente seções de referências ou fontes e não invente artigo, link ou conteúdo normativo específico.",
    "Não presuma regra municipal específica e não diga que consultou documentos, Recovery ou pesquisa web.",
    "Use conhecimento jurídico e administrativo consolidado, distinguindo explicação geral de regra local quando essa diferença for relevante.",
    "Se uma norma ajudar a explicar o tema, mencione-a apenas quando tiver segurança e sem inventar artigo, link ou conteúdo específico.",
    "Seja completo na medida da pergunta, sem acrescentar recomendações, riscos ou cautelas que não sejam necessários para respondê-la.",
  ].join("\n");
}
