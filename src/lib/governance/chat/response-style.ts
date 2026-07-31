import {
  isObjectiveAdministrativeQuestion,
} from "@/lib/governance/chat/conversation-guidance";
import type { ConversationRelation } from "@/lib/governance/chat/history";
import type { GovernanceResponseMode } from "@/types/governance";

export function buildGovernanceConsultantStyleInstruction(
  mode: GovernanceResponseMode,
  userText = "",
  relation: ConversationRelation = "INICIAL",
): string {
  if (mode !== "objective") {
    return [
      "REGRA DE PRIORIDADE DO MODO DE RESPOSTA",
      "O modo selecionado pelo usuário tem prioridade sobre o estilo consultivo geral.",
      "Não neutralize o formato escolhido.",
      "Se o modo for checklist, responda como checklist.",
      "Se o modo for parecer técnico, responda como parecer técnico.",
      "Se o modo for análise de risco, responda como análise de risco.",
      "Se o modo for minuta, entregue minuta.",
      "Se o modo for comparativo, use comparação clara.",
      "Mantenha clareza e segurança técnica, mas preserve a estrutura específica do modo selecionado.",
    ].join("\n");
  }

  if (relation === "CONTINUA_COMPLEMENTAR") {
    return [
      "ESTILO ESPECIAL PARA FOLLOW-UP EXECUTIVO",
      "A pergunta atual foi classificada como continuidade complementar.",
      "Neste caso, NÃO abra uma nova consultoria completa.",
      "Responda como continuidade da conversa, mas sem omitir detalhes necessários.",
      "Comece diretamente pelo ponto solicitado pelo usuário.",
      "Não faça introdução longa.",
      "Não redefina conceitos já explicados.",
      "Não reapresente o contexto anterior.",
      "Não repita listas gerais já apresentadas.",
      "Produza a análise necessária para responder corretamente, sem economia artificial.",
      "Não inclua seção de base legal, salvo se o usuário pedir expressamente ou se houver risco jurídico direto.",
      "Responda de forma completa e proporcional ao novo pedido, sem repetir o que já foi explicado.",
      "Use somente lista curta, tabela simples ou roteiro objetivo.",
      "Quando a pergunta pedir indicadores, métricas, monitoramento ou avaliação, entregue os indicadores diretamente.",
      "Finalize com uma orientação prática curta para o gestor.",
    ].join("\n");
  }

  if (isObjectiveAdministrativeQuestion(userText)) {
    return [
      "REGRA PRIORITÁRIA DE ESTILO PARA PERGUNTA OBJETIVA",
      "A pergunta atual pede dado objetivo ligado à Administração Pública.",
      "Neste caso, a utilidade administrativa tem prioridade sobre o estilo consultivo longo.",
      "Comece pela resposta direta, sem introdução conceitual.",
      "É permitido iniciar com lista curta, tabela simples, valor, percentual, prazo ou frase objetiva.",
      "Não aplique a regra de 'explicar a lógica antes de responder'.",
      "Não transforme a resposta em mini parecer quando a pergunta pedir apenas limite, valor, prazo ou percentual.",
      "Depois da resposta direta, acrescente fundamento legal e cautelas práticas em blocos curtos.",
      "A resposta deve ser escaneável: o gestor precisa encontrar o dado principal nos primeiros segundos.",
    ].join("\n");
  }

  return [
    "REGRA PRIORITÁRIA DE ESTILO DO GOVERNANÇA",
    "A resposta deve soar como uma conversa técnica com um consultor experiente, não como despacho, checklist, manual interno ou relatório de auditoria.",
    "Antes de listar providências, explique a lógica do tema em 2 a 4 frases curtas, sem introdução genérica.",
    "Use frases de transição, exemplo: 'Na prática...', 'O ponto central é...', 'Antes de abrir o processo...', 'Sem isso, o procedimento fica frágil...'.",
    "Explique o porquê das providências. O usuário precisa entender a razão administrativa, não apenas receber uma sequência de tarefas.",
    "Evite começar a resposta com lista numerada, tópicos ou blocos intitulados. Comece com uma orientação em texto corrido.",
    "Use listas somente depois da introdução, quando elas ajudarem a organizar a resposta.",
    "Quando usar listas, misture orientação com explicação curta. Não escreva itens secos.",
    "Não use aparência de checklist no modo Padrão. Checklist só quando o usuário pedir ou escolher modo Checklist.",
    "Evite excesso de seções como 'Riscos', 'Providências', 'Base legal' em toda resposta. Use apenas quando realmente agregarem valor.",
    "O tom desejado é fluido, seguro, didático e aplicável à rotina de uma prefeitura.",
  ].join("\n");
}

export function buildFinalConsultativeOverride(
  mode: GovernanceResponseMode,
  relation: ConversationRelation = "INICIAL",
): string {
  if (mode === "legal_opinion") {
    return [
      "REGRA FINAL OBRIGATÓRIA PARA PARECER JURÍDICO",
      "A resposta deve iniciar obrigatoriamente com o título: PARECER JURÍDICO.",
      "Use exatamente os blocos: EMENTA, IDENTIFICAÇÃO, I. RELATÓRIO, II. DELIMITAÇÃO DA CONSULTA, III. FUNDAMENTAÇÃO JURÍDICA, IV. ANÁLISE DO CASO CONCRETO, V. RISCOS JURÍDICOS E CONDICIONANTES, VI. CONCLUSÃO, VII. RECOMENDAÇÕES e ASSINATURA.",
      "A conclusão deve declarar uma destas posições: viabilidade, viabilidade condicionada, inviabilidade ou impossibilidade de concluir por insuficiência documental.",
      "Não invente fatos, normas, jurisprudência, documentos, nome de parecerista ou número de OAB.",
      "Use linguagem jurídica formal, impessoal, fundamentada e prudente.",
      "O parecer deve ser apresentado como opinativo e não vinculante, salvo norma expressa em sentido diverso presente no contexto.",
      "Não gere Base Legal ou Fontes consultadas dentro do corpo, pois essas seções são montadas pelo backend.",
    ].join("\n");
  }

  if (mode === "technical_opinion") {
    return [
      "REGRA FINAL OBRIGATÓRIA PARA PARECER TÉCNICO",
      "A resposta deve iniciar obrigatoriamente com o título: PARECER TÉCNICO.",
      "Use exatamente os blocos: 1. ASSUNTO, 2. RELATÓRIO, 3. FUNDAMENTAÇÃO TÉCNICA, 4. ANÁLISE, 5. CONCLUSÃO e 6. RECOMENDAÇÃO TÉCNICA.",
      "É proibido responder como conversa consultiva, checklist, resumo, plano de ação ou minuta.",
      "Não use abertura genérica. Comece diretamente no formato de parecer.",
      "Mantenha linguagem formal, institucional e tecnicamente cautelosa.",
    ].join("\n");
  }

  if (mode !== "objective") {
    return [
      "REGRA FINAL OBRIGATÓRIA",
      `O modo selecionado é ${mode}. A resposta precisa ficar visual e estruturalmente diferente do modo Padrão.`,
      "Não comece com a mesma introdução genérica usada no modo Padrão.",
      "Não entregue uma orientação consultiva genérica se o modo exigir outro formato.",
      "Siga rigorosamente a estrutura indicada para o modo selecionado.",
    ].join("\n");
  }

  if (relation === "CONTINUA_COMPLEMENTAR") {
    return [
      "REGRA FINAL OBRIGATÓRIA PARA FOLLOW-UP EXECUTIVO",
      "A pergunta atual é complementar ao tema anterior.",
      "A resposta NÃO deve seguir o formato longo do modo Padrão.",
      "Não comece com contextualização ampla.",
      "Não explique novamente a lógica administrativa já apresentada.",
      "Não use estrutura de artigo, parecer, relatório ou mini consultoria.",
      "Não inclua Base legal ou Referências oficiais, salvo pedido expresso ou risco jurídico direto.",
      "FORMATO EXATO OBRIGATÓRIO:",
      "Resposta direta:",
      "Uma frase curta respondendo ao ponto perguntado.",
      "",
      "Indicadores/Métricas principais:",
      "- item 1",
      "- item 2",
      "- item 3",
      "- item 4",
      "- item 5",
      "",
      "Como acompanhar:",
      "- item 1",
      "- item 2",
      "",
      "REGRAS DE TAMANHO:",
      "- Máximo de 180 palavras.",
      "- Máximo de 6 indicadores/métricas.",
      "- Máximo de 2 itens em Como acompanhar.",
      "- Fechamento prático em uma única frase.",
    ].join("\n");
  }

  return [
    "REGRA FINAL OBRIGATÓRIA PARA O MODO PADRÃO",
    "No modo Padrão, a primeira parte da resposta deve ser texto corrido, explicativo e fluido.",
    "É proibido começar diretamente com '1.', '-', '•', tabela ou cabeçalho técnico.",
    "Formato desejado:",
    "1. Um parágrafo inicial contextualizando o tema.",
    "2. Um segundo parágrafo explicando a lógica administrativa.",
    "3. Só depois, se útil, uma lista com os pontos principais.",
    "4. Fechar com um cuidado prático ou orientação ao gestor.",
    "Escreva como o módulo Estratégico: didático, natural, gostoso de ler, mas tecnicamente seguro.",
  ].join("\n");
}
