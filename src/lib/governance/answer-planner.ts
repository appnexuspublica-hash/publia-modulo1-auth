// src/lib/governance/answer-planner.ts

import type { GovernanceResponseMode } from "@/types/governance";

type BuildGovernanceAnswerPlanParams = {
  responseMode: GovernanceResponseMode;
  question: string;
  hasEvidenceContext: boolean;
  hasMunicipalContext: boolean;
};

function buildObjectivePlan(): string[] {
  return [
    "FORMATO OBRIGATÓRIO DO MODO PADRÃO CONSULTIVO:",
    "",
    "## 1. Resposta objetiva",
    "Comece pela conclusão principal em 2 a 5 frases. Responda diretamente ao que foi perguntado, sem introdução genérica.",
    "",
    "## 2. Fundamentação",
    "Explique, de forma sintética, as razões jurídicas, técnicas ou administrativas que sustentam a resposta.",
    "",
    "## 3. Entendimento atual",
    "Apresente o entendimento vigente de órgãos de controle, tribunais ou autoridades competentes quando for relevante. Diferencie lei, orientação, jurisprudência e boa prática.",
    "",
    "## 4. Aplicação ao Município",
    "Traduza a conclusão para a rotina municipal. Indique providências práticas, áreas envolvidas e forma segura de aplicação.",
    "",
    "## 5. Cuidados",
    "Liste riscos, exceções, documentos necessários, validações e situações que exigem análise jurídica, controle interno ou confirmação oficial.",
    "",
    "Use exatamente os títulos acima e não omita nenhuma das cinco seções.",
  ];
}

function buildModePlan(mode: GovernanceResponseMode): string[] {
  switch (mode) {
    case "summary":
      return [
        "FORMATO OBRIGATÓRIO DO MODO RESUMO:",
        "- Não use a estrutura numerada de cinco blocos do modo padrão.",
        "- Entregue uma síntese curta, com um parágrafo inicial, até 5 pontos essenciais e uma conclusão prática breve.",
        "- Preserve apenas fundamentos indispensáveis, sem desenvolver parecer, checklist ou plano de ação.",
      ];

    case "checklist":
      return [
        "FORMATO OBRIGATÓRIO DO MODO CHECKLIST:",
        "- Não use a estrutura numerada de cinco blocos do modo padrão.",
        "- Inicie com o título 'CHECKLIST PRÁTICO'.",
        "- Use predominantemente itens verificáveis iniciados por '☐'.",
        "- Agrupe os itens por etapas ou temas quando isso melhorar a execução.",
        "- Evite parágrafos longos.",
      ];

    case "technical_opinion":
      return [
        "FORMATO OBRIGATÓRIO DO MODO PARECER TÉCNICO:",
        "- Não use a estrutura numerada de cinco blocos do modo padrão.",
        "- Preserve integralmente a estrutura institucional: PARECER TÉCNICO; 1. ASSUNTO; 2. RELATÓRIO; 3. FUNDAMENTAÇÃO TÉCNICA; 4. ANÁLISE; 5. CONCLUSÃO; 6. RECOMENDAÇÃO TÉCNICA.",
        "- Redija como documento técnico, sem linguagem conversacional e sem simular parecer jurídico vinculante.",
      ];

    case "legal_opinion":
      return [
        "FORMATO OBRIGATÓRIO DO MODO PARECER JURÍDICO:",
        "- Não use a estrutura numerada de cinco blocos do modo padrão.",
        "- Redija como manifestação jurídica institucional, completa, técnica, cautelosa e não vinculante, salvo se o contexto trouxer norma expressa em sentido diverso.",
        "- Inicie obrigatoriamente com o título 'PARECER JURÍDICO'.",
        "- Use exatamente esta estrutura: EMENTA; IDENTIFICAÇÃO; I. RELATÓRIO; II. DELIMITAÇÃO DA CONSULTA; III. FUNDAMENTAÇÃO JURÍDICA; IV. ANÁLISE DO CASO CONCRETO; V. RISCOS JURÍDICOS E CONDICIONANTES; VI. CONCLUSÃO; VII. RECOMENDAÇÕES; ASSINATURA.",
        "- Em IDENTIFICAÇÃO, use campos editáveis quando faltarem dados: Processo nº [informar]; Interessado [informar]; Órgão consulente [informar]; Assunto [informar].",
        "- Em FUNDAMENTAÇÃO JURÍDICA, examine somente quando pertinente e sustentado pelas evidências: Constituição; legislação federal, estadual e municipal; regulamentos; princípios administrativos; jurisprudência; orientações dos Tribunais de Contas; doutrina ou documentos institucionais.",
        "- Diferencie claramente: obrigação legal, entendimento jurisprudencial, orientação de órgão de controle, boa prática e norma municipal.",
        "- Na ANÁLISE DO CASO CONCRETO, relacione fatos, requisitos, competência, forma, finalidade, motivação, procedimento, documentos e condições de validade.",
        "- Em RISCOS JURÍDICOS E CONDICIONANTES, indique riscos de nulidade, responsabilização, glosa, impugnação, controle externo ou judicialização, sem alarmismo.",
        "- Na CONCLUSÃO, use fórmula objetiva: viabilidade; viabilidade condicionada; inviabilidade; ou impossibilidade de concluir por insuficiência documental.",
        "- Nas RECOMENDAÇÕES, liste providências prévias, documentos faltantes, validações e ajustes necessários.",
        "- Em ASSINATURA, use apenas placeholders: [NOME DO PROCURADOR/ASSESSOR JURÍDICO], [CARGO], OAB/[UF] nº [NÚMERO], [LOCAL], [DATA]. Nunca invente nome, cargo ou número de OAB.",
        "- Não afirme que o parecer é vinculante ou obrigatório sem base normativa específica.",
        "- Não atribua responsabilidade automática ao parecerista. Quando pertinente, diferencie divergência interpretativa, erro grosseiro, dolo e fraude.",
        "- Não crie seção própria de Base Legal ou Fontes consultadas no corpo: essas seções serão acrescentadas pelo backend.",
        "- Inclua aviso final discreto: 'Manifestação gerada para apoio técnico, sujeita à conferência dos autos e à validação da assessoria jurídica competente.'",
      ];

    case "risk_analysis":
      return [
        "FORMATO OBRIGATÓRIO DO MODO ANÁLISE DE RISCO:",
        "- Não use a estrutura numerada de cinco blocos do modo padrão.",
        "- Apresente uma matriz ou lista estruturada contendo, para cada item: risco, probabilidade, impacto, consequência e mitigação.",
        "- Finalize com prioridades de controle.",
        "- Não transforme a resposta em orientação genérica ou parecer.",
      ];

    case "attention_points":
      return [
        "FORMATO OBRIGATÓRIO DO MODO PONTOS DE ATENÇÃO:",
        "- Não use a estrutura numerada de cinco blocos do modo padrão.",
        "- Inicie com o título 'PONTOS DE ATENÇÃO'.",
        "- Use alertas curtos e objetivos, destacando conformidade, documentação, prazos, responsabilidades e validações.",
        "- Não transforme a resposta em plano de ação completo.",
      ];

    case "action_plan":
      return [
        "FORMATO OBRIGATÓRIO DO MODO PLANO DE AÇÃO:",
        "- Não use a estrutura numerada de cinco blocos do modo padrão.",
        "- Use tabela Markdown com: Etapa | Ação | Responsável sugerido | Prazo sugerido | Resultado esperado.",
        "- Depois da tabela, apresente somente 3 prioridades imediatas.",
        "- Não escreva parecer, minuta ou resumo.",
      ];

    case "draft":
      return [
        "FORMATO OBRIGATÓRIO DO MODO MINUTA:",
        "- Não use a estrutura numerada de cinco blocos do modo padrão.",
        "- Entregue diretamente uma minuta formal e editável.",
        "- Use título, linguagem institucional, campos faltantes entre colchetes e observação final de validação técnica/jurídica.",
        "- Não acrescente explicação extensa antes ou depois da minuta.",
      ];

    case "comparison":
      return [
        "FORMATO OBRIGATÓRIO DO MODO COMPARATIVO:",
        "- Não use a estrutura numerada de cinco blocos do modo padrão.",
        "- Use tabela Markdown com critérios adequados ao tema e as alternativas comparadas.",
        "- Depois da tabela, apresente uma conclusão comparativa objetiva.",
        "- Não transforme a resposta em parecer ou checklist.",
      ];

    case "manager_guidance":
      return [
        "FORMATO OBRIGATÓRIO DO MODO ORIENTAÇÃO AO GESTOR:",
        "- Não use a estrutura numerada de cinco blocos do modo padrão.",
        "- Organize a resposta em: decisão necessária; o que observar; providências recomendadas; riscos da inação; próximo passo.",
        "- Use tom executivo, direto e orientado à decisão.",
      ];

    case "objective":
    default:
      return buildObjectivePlan();
  }
}

export function buildGovernanceAnswerPlan({
  responseMode,
  question,
  hasEvidenceContext,
  hasMunicipalContext,
}: BuildGovernanceAnswerPlanParams) {
  const evidenceInstruction = hasEvidenceContext
    ? "Há um dossiê prévio de evidências oficiais disponível. Use-o como referência prioritária e não crie atos, acórdãos, números, datas ou URLs que não estejam sustentados por esse contexto."
    : "Não invente atos, acórdãos, números, datas ou URLs. Quando faltar evidência suficiente, declare a limitação de forma objetiva.";

  const municipalInstruction = hasMunicipalContext
    ? "Há contexto institucional ou municipal disponível. Use-o somente quando for pertinente e diferencie claramente norma geral, orientação de controle e prática local."
    : "Não presuma regra municipal específica sem evidência no contexto.";

  return [
    "PLANEJADOR ADAPTATIVO DA RESPOSTA — GOVERNANÇA",
    "",
    `Pergunta atual: ${question}`,
    "",
    ...buildModePlan(responseMode),
    "",
    "BASE LEGAL E FONTES:",
    "- O backend acrescentará automaticamente as seções finais de Base Legal e Fontes consultadas.",
    "- Não escreva, antecipe ou repita seções chamadas 'Base Legal', 'Fontes', 'Fontes consultadas', 'Referências' ou equivalentes.",
    "- No corpo, mencione somente normas, decisões e documentos sustentados pelo contexto disponível.",
    "",
    "REGRAS GERAIS DE QUALIDADE:",
    "- O formato específico do modo ativo prevalece sobre qualquer estrutura genérica.",
    "- Não misture formatos: resumo não vira parecer; minuta não vira explicação; plano de ação não vira análise narrativa.",
    "- Evite repetição, introduções genéricas e respostas excessivamente longas.",
    "- Use subtítulos internos apenas quando forem compatíveis com o modo ativo.",
    "- Não use cards coloridos, emojis decorativos ou linguagem promocional.",
    "- Não encerre oferecendo ajuda adicional.",
    "- Não trate boa prática como obrigação legal.",
    "- Não misture fonte municipal com fonte normativa federal sem indicar a diferença.",
    `- ${evidenceInstruction}`,
    `- ${municipalInstruction}`,
  ].join("\n");
}
