import type { GovernanceResponseMode } from "@/types/governance";

export function mapGovernanceModeToPromptMode(
  mode: GovernanceResponseMode,
):
  | "objective"
  | "summary"
  | "step_by_step"
  | "checklist"
  | "document_draft"
  | "manager_guidance" {
  switch (mode) {
    case "summary":
      return "summary";

    case "checklist":
    case "risk_analysis":
    case "attention_points":
    case "action_plan":
    case "comparison":
      return "checklist";

    case "technical_opinion":
    case "legal_opinion":
    case "draft":
      return "document_draft";

    case "manager_guidance":
      return "manager_guidance";

    case "objective":
    default:
      return "objective";
  }
}

export function buildGovernanceModeInstruction(mode: GovernanceResponseMode): string {
  switch (mode) {
    case "summary":
      return [
        "MODO DE RESPOSTA ATIVO: RESUMO.",
        "OBEDEÇA AO FORMATO: entregue uma síntese curta, sem parecer, sem checklist longo e sem plano de ação.",
        "Estrutura obrigatória:",
        "1. Comece com 1 parágrafo de visão geral.",
        "2. Depois apresente no máximo 5 pontos essenciais.",
        "3. Finalize com uma conclusão prática em 1 parágrafo.",
        "Limite a resposta a uma versão enxuta, focada no essencial.",
      ].join("\n");

    case "checklist":
      return [
        "MODO DE RESPOSTA ATIVO: CHECKLIST.",
        "OBEDEÇA AO FORMATO: a resposta deve ser predominantemente uma lista verificável.",
        "Estrutura obrigatória:",
        "Título: CHECKLIST PRÁTICO",
        "Use itens iniciados por '☐'.",
        "Cada item deve ser acionável e verificável.",
        "Evite parágrafos longos. Não escreva parecer, minuta ou análise de risco.",
      ].join("\n");

    case "technical_opinion":
      return [
        "MODO DE RESPOSTA ATIVO: PARECER TÉCNICO.",
        "OBEDEÇA AO FORMATO: a resposta deve iniciar obrigatoriamente com o título PARECER TÉCNICO.",
        "Escreva como documento técnico institucional, não como conversa, resumo, checklist, minuta ou orientação ao gestor.",
        "Use obrigatoriamente estes blocos, nesta ordem e com títulos em caixa alta:",
        "PARECER TÉCNICO",
        "",
        "1. ASSUNTO",
        "Indique em uma frase o tema analisado.",
        "",
        "2. RELATÓRIO",
        "Contextualize brevemente a situação apresentada pelo usuário.",
        "",
        "3. FUNDAMENTAÇÃO TÉCNICA",
        "Aponte os fundamentos administrativos, técnicos e normativos aplicáveis, sem inventar norma local.",
        "",
        "4. ANÁLISE",
        "Examine o caso de forma objetiva, relacionando fatos, cautelas, riscos e condições de validade.",
        "",
        "5. CONCLUSÃO",
        "Apresente conclusão clara sobre o entendimento técnico.",
        "",
        "6. RECOMENDAÇÃO TÉCNICA",
        "Indique as providências recomendadas ao órgão.",
        "",
        "É proibido começar com introdução conversacional do tipo 'Na prática' ou 'O ponto central é'.",
        "É proibido responder apenas com tópicos soltos. O formato deve parecer um parecer técnico institucional.",
      ].join("\n");

    case "legal_opinion":
      return [
        "MODO DE RESPOSTA ATIVO: PARECER JURÍDICO.",
        "OBEDEÇA AO FORMATO: a resposta deve iniciar obrigatoriamente com o título PARECER JURÍDICO.",
        "Escreva como manifestação jurídica institucional completa, não como parecer técnico, conversa, resumo, checklist, minuta ou orientação ao gestor.",
        "Use obrigatoriamente estes blocos, nesta ordem:",
        "PARECER JURÍDICO",
        "EMENTA",
        "IDENTIFICAÇÃO",
        "I. RELATÓRIO",
        "II. DELIMITAÇÃO DA CONSULTA",
        "III. FUNDAMENTAÇÃO JURÍDICA",
        "IV. ANÁLISE DO CASO CONCRETO",
        "V. RISCOS JURÍDICOS E CONDICIONANTES",
        "VI. CONCLUSÃO",
        "VII. RECOMENDAÇÕES",
        "ASSINATURA",
        "A conclusão deve classificar o caso como: viável, viável com condicionantes, inviável ou insuficientemente instruído.",
        "Use campos entre colchetes para dados ausentes. Nunca invente processo, interessado, procurador, cargo, OAB, local ou data.",
        "Não trate o parecer como vinculante sem norma expressa no contexto.",
        "Não repita Base Legal nem Fontes consultadas; o backend acrescentará essas seções.",
      ].join("\n");

    case "risk_analysis":
      return [
        "MODO DE RESPOSTA ATIVO: ANÁLISE DE RISCO.",
        "OBEDEÇA AO FORMATO: a resposta deve mapear riscos, não virar orientação genérica.",
        "Estrutura obrigatória:",
        "1. Matriz de riscos em tópicos ou tabela.",
        "2. Para cada risco, indique: risco, probabilidade, impacto, consequência e mitigação.",
        "3. Finalize com prioridades de controle.",
        "Não escreva como resumo, parecer ou checklist simples.",
      ].join("\n");

    case "attention_points":
      return [
        "MODO DE RESPOSTA ATIVO: PONTOS DE ATENÇÃO.",
        "OBEDEÇA AO FORMATO: liste alertas objetivos e cuidados críticos.",
        "Estrutura obrigatória:",
        "Título: PONTOS DE ATENÇÃO",
        "Use tópicos curtos iniciados por 'Atenção:'.",
        "Destaque riscos de conformidade, documentação, prazos, responsabilidades e validações necessárias.",
        "Não transforme em plano de ação completo.",
      ].join("\n");

    case "action_plan":
      return [
        "MODO DE RESPOSTA ATIVO: PLANO DE AÇÃO.",
        "OBEDEÇA AO FORMATO: organize ações práticas em sequência operacional.",
        "Estrutura obrigatória:",
        "Use uma tabela em Markdown com as colunas: Etapa | Ação | Responsável sugerido | Prazo sugerido | Resultado esperado.",
        "Depois da tabela, inclua apenas 3 prioridades imediatas.",
        "Não escreva parecer, minuta ou resumo.",
      ].join("\n");

    case "draft":
      return [
        "MODO DE RESPOSTA ATIVO: MINUTA.",
        "OBEDEÇA AO FORMATO: produza um texto formal editável, pronto para adaptação pelo órgão.",
        "Estrutura obrigatória:",
        "1. Título da minuta.",
        "2. Texto em linguagem institucional.",
        "3. Campos faltantes entre colchetes, como [NOME DO ÓRGÃO], [DATA], [RESPONSÁVEL].",
        "4. Observação final de validação jurídica/técnica.",
        "Não responda com explicação longa; entregue a minuta.",
      ].join("\n");

    case "comparison":
      return [
        "MODO DE RESPOSTA ATIVO: COMPARATIVO.",
        "OBEDEÇA AO FORMATO: compare alternativas, cenários, regras ou caminhos.",
        "Estrutura obrigatória:",
        "Use uma tabela em Markdown com colunas adequadas ao tema, por exemplo: Critério | Opção A | Opção B | Observação.",
        "Depois da tabela, inclua uma conclusão comparativa objetiva.",
        "Não escreva como checklist ou parecer.",
      ].join("\n");

    case "manager_guidance":
      return [
        "MODO DE RESPOSTA ATIVO: ORIENTAÇÃO AO GESTOR.",
        "OBEDEÇA AO FORMATO: responda para apoiar decisão administrativa.",
        "Estrutura obrigatória:",
        "1. Decisão que o gestor precisa tomar.",
        "2. O que observar antes de decidir.",
        "3. Providências recomendadas.",
        "4. Riscos se nada for feito.",
        "5. Próximo passo sugerido.",
        "Use tom direto, executivo e prático.",
      ].join("\n");

    case "objective":
    default:
      return [
        "MODO DE RESPOSTA ATIVO: PADRÃO CONSULTIVO.",
        "Responda de forma natural, consultiva e didática.",
        "Comece com texto corrido explicando a lógica do tema.",
        "Depois, se útil, organize os principais pontos práticos.",
        "Não force formato de checklist, parecer, minuta, tabela ou plano de ação, salvo pedido expresso do usuário.",
      ].join("\n");
  }
}

