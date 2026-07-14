import {
  ESSENTIAL_BASE_OFFICIAL_DOMAINS,
  OFFICIAL_AUTHORITY_ORDER,
  OFFICIAL_DOMAINS_BY_TOPIC,
} from "./domains";
import type {
  OfficialWebResolution,
  OfficialWebTopic,
} from "./types";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectTopic(question: string): OfficialWebTopic {
  const text = normalize(question);

  if (
    /\b(licitacao|licitacoes|licitar|dispensa|inexigibilidade|pregao|contratacao direta|contrato administrativo|ata de registro|pncp|compras\.?gov)\b/.test(
      text,
    )
  ) {
    return "bidding";
  }

  if (
    /\b(contabilidade|contabil|mcasp|mdf|mto|siconfi|siafi|finbra|balanco|demonstrativo fiscal|lrf|responsabilidade fiscal|restos a pagar|empenho|liquidacao)\b/.test(
      text,
    )
  ) {
    return "accounting";
  }

  if (
    /\b(convenio|transferencia|transferegov|repasse|plano de trabalho|prestacao de contas|cauc)\b/.test(
      text,
    )
  ) {
    return "transfers";
  }

  if (
    /\b(ibge|sidra|ipea|ipeadata|populacao|municipio|municipal|indicador|dados oficiais|datasus|inep|siops|siope|banco central)\b/.test(
      text,
    )
  ) {
    return "municipal_data";
  }

  if (
    /\b(receita federal|tributo|tributacao|imposto|irrf|inss|retencao|contribuicao|aliquota|simples nacional|ctn)\b/.test(
      text,
    )
  ) {
    return "tax";
  }

  if (
    /\b(transparencia|acesso a informacao|lai|portal da transparencia|cgu|controle social|dados abertos)\b/.test(
      text,
    )
  ) {
    return "transparency";
  }

  if (
    /\b(servidor|servidores|pessoal|concurso|cargo|emprego publico|remuneracao|diaria|nepotismo|acumulacao de cargos|previdencia)\b/.test(
      text,
    )
  ) {
    return "personnel";
  }

  if (
    /\b(lgpd|protecao de dados|dado pessoal|dados pessoais|anpd|privacidade)\b/.test(
      text,
    )
  ) {
    return "privacy";
  }

  if (
    /\b(constituicao|lei|decreto|portaria|instrucao normativa|resolucao|acordao|jurisprudencia|competencia|norma|legislacao)\b/.test(
      text,
    )
  ) {
    return "legislation";
  }

  return "general";
}

const HIERARCHIES: Record<OfficialWebTopic, string[]> = {
  legislation: [
    "Constituição Federal e, quando pertinente, Constituição Estadual",
    "Lei federal ou estadual aplicável",
    "Lei Orgânica e legislação municipal somente quando o contexto local estiver disponível",
    "Decretos regulamentadores",
    "Portarias, instruções normativas e resoluções",
    "Diário Oficial que publicou o ato",
    "Jurisprudência dos tribunais competentes",
    "Entendimento do Tribunal de Contas competente",
  ],
  bidding: [
    "Constituição Federal",
    "Lei nº 14.133/2021 e legislação específica vigente",
    "Regulamentação aplicável",
    "Portal Nacional de Contratações Públicas — PNCP",
    "Compras.gov.br e demais sistemas oficiais pertinentes",
    "Diário Oficial e Portal da Transparência, quando houver contexto específico",
    "TCU e Tribunal de Contas competente",
    "CGU, CEIS, CNEP, SICAF e Receita Federal, conforme o caso",
  ],
  accounting: [
    "Constituição Federal",
    "Lei nº 4.320/1964",
    "Lei Complementar nº 101/2000",
    "Normas e manuais vigentes da STN — MCASP, MDF e MTO",
    "SICONFI, FINBRA, CAUC e sistemas oficiais aplicáveis",
    "Portal da Transparência",
    "TCU e Tribunal de Contas competente",
    "Legislação orçamentária e documentos do ente, quando fornecidos",
  ],
  transfers: [
    "Norma que instituiu o programa",
    "Transferegov.br",
    "Instrumento celebrado e plano de trabalho, quando fornecidos",
    "Portarias e manuais do ministério concedente",
    "CAUC",
    "SIAFI e Portal da Transparência",
    "CGU e TCU",
    "Tribunal de Contas competente",
  ],
  municipal_data: [
    "IBGE e IBGE Cidades",
    "SIDRA",
    "SICONFI e FINBRA",
    "INEP, DATASUS, SIOPS, SIOPE ou base setorial oficial",
    "IPEA e Ipeadata",
    "Banco Central, quando houver variável econômica ou financeira",
    "Instituto estadual de estatística",
    "Cadastro ou sistema municipal somente quando fornecido pelo usuário",
  ],
  tax: [
    "Constituição Federal e Código Tributário Nacional",
    "Legislação federal vigente no Planalto",
    "Receita Federal e atos normativos vigentes",
    "Diário Oficial da União",
    "Jurisprudência dos tribunais competentes",
    "Orientações oficiais complementares",
  ],
  transparency: [
    "Constituição Federal",
    "Lei de Acesso à Informação e legislação correlata",
    "CGU e Portal da Transparência",
    "TCU e Tribunal de Contas competente",
    "PNCP e Compras.gov.br quando o tema envolver contratações",
    "Portais e dados oficiais do ente, quando houver contexto específico",
  ],
  personnel: [
    "Constituição Federal",
    "Legislação federal aplicável",
    "Regime jurídico e legislação local somente quando fornecidos",
    "Atos normativos e Diário Oficial",
    "Jurisprudência dos tribunais",
    "TCU e Tribunal de Contas competente",
  ],
  privacy: [
    "Constituição Federal",
    "Lei nº 13.709/2018 — LGPD",
    "ANPD e regulamentação vigente",
    "Diário Oficial da União",
    "Jurisprudência dos tribunais competentes",
  ],
  general: [
    "Fontes normativas primárias",
    "Órgãos jurisdicionais competentes",
    "Órgãos fiscalizadores e de controle",
    "Sistemas operacionais oficiais",
    "Bases estatísticas oficiais",
    "Publicações informativas oficiais",
  ],
};

const TOPIC_LABELS: Record<OfficialWebTopic, string> = {
  legislation: "Legislação e competência",
  bidding: "Licitações e contratos",
  accounting: "Contabilidade e responsabilidade fiscal",
  transfers: "Convênios e transferências",
  municipal_data: "Dados municipais e indicadores",
  tax: "Tributação",
  transparency: "Transparência e controle social",
  personnel: "Pessoal e servidores",
  privacy: "Proteção de dados e LGPD",
  general: "Administração pública — consulta geral",
};


function buildResearchChecklist(
  question: string,
  topic: OfficialWebTopic,
): string[] {
  const text = normalize(question);
  const checklist: string[] = [
    "Localizar ao menos uma fonte oficial primária diretamente relacionada à pergunta.",
    "Verificar data, vigência e eventual ato posterior antes de afirmar que uma regra, valor, prazo ou entendimento está atual.",
    "Preservar os links exatos das páginas oficiais efetivamente utilizadas.",
  ];

  const asksCurrent =
    /\b(atual|atuais|atualizado|atualizada|vigente|vigentes|hoje|ainda vale|ainda valem|mais recente|ultimo|ultima|2026)\b/.test(
      text,
    );

  if (asksCurrent) {
    checklist.push(
      "A pergunta exige atualidade: procurar expressamente norma, decisão, manual ou dado posterior que possa ter alterado a referência original.",
    );
  }

  if (
    topic === "bidding" &&
    /\b(dispensa|sem licitar|sem licitacao|100 mil|50 mil|artigo 75|art\.? 75)\b/.test(
      text,
    )
  ) {
    checklist.push(
      "Consultar a Lei nº 14.133/2021, especialmente os arts. 75 e 182, e localizar o decreto anual mais recente que atualiza os valores.",
      "Para respostas referentes a 2026, verificar expressamente o Decreto nº 12.807, de 29 de dezembro de 2025, e não repetir como vigentes os valores originais de R$ 100.000,00 e R$ 50.000,00.",
      "Responder primeiro com os valores vigentes e só depois explicar procedimento, fracionamento e cautelas.",
    );
  }

  if (
    topic === "tax" &&
    /\b(irrf|imposto de renda retido|retencao de ir|retenção de ir)\b/.test(
      text,
    )
  ) {
    checklist.push(
      "Distinguir titularidade da receita de obrigação de retenção.",
      "Consultar a Constituição Federal, art. 158, I; o Tema 1.130 do STF; e a redação vigente da IN RFB nº 1.234/2012 ou ato oficial que a tenha alterado.",
      "Explicar separadamente pagamentos a pessoas físicas e jurídicas, sem afirmar que todo pagamento sofre retenção.",
    );
  }

  if (
    topic === "accounting" &&
    /\b(despesa com pessoal|limite prudencial|limite de alerta|lrf)\b/.test(
      text,
    )
  ) {
    checklist.push(
      "Consultar a LC nº 101/2000, especialmente os arts. 19, 20, 22 e 59, e material técnico vigente da STN quando necessário.",
      "Distinguir limite global do ente, repartição por Poder, limite prudencial e limite de alerta.",
    );
  }

  if (
    topic === "municipal_data" &&
    /\b(populacao|população|habitantes|ibge)\b/.test(text)
  ) {
    checklist.push(
      "Usar a estimativa ou resultado oficial mais recente do IBGE, informando claramente o ano e a data de referência.",
    );
  }

  return checklist;
}

export function resolveEssentialOfficialWeb(
  question: string,
): OfficialWebResolution {
  const topic = detectTopic(question);

  const allowedDomains = Array.from(
    new Set([
      ...OFFICIAL_DOMAINS_BY_TOPIC[topic],
      ...ESSENTIAL_BASE_OFFICIAL_DOMAINS,
    ]),
  );

  return {
    topic,
    topicLabel: TOPIC_LABELS[topic],
    allowedDomains,
    hierarchy: HIERARCHIES[topic],
    authorityOrder: OFFICIAL_AUTHORITY_ORDER,
    researchChecklist: buildResearchChecklist(question, topic),
  };
}

export function buildOfficialWebInstruction(
  resolution: OfficialWebResolution,
): string {
  return [
    "CONSULTA WEB OFICIAL — OBRIGATÓRIA PARA ESTA RESPOSTA",
    `Tema identificado: ${resolution.topicLabel}.`,
    "",
    "Antes de responder, execute pesquisa web e use prioritariamente fontes oficiais.",
    "Não responda apenas com conhecimento interno do modelo.",
    "A pesquisa deve respeitar, sempre que aplicável, esta ordem de consulta:",
    ...resolution.hierarchy.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Hierarquia prática de autoridade:",
    "1. Normativa — Constituição, leis, decretos, portarias, instruções normativas e resoluções.",
    "2. Jurisdicional — STF, STJ, tribunais e demais órgãos judiciais competentes.",
    "3. Fiscalizadora — TCU, TCE, TCM, CGU, controladorias e reguladores.",
    "4. Operacional — PNCP, Compras.gov.br, SICONFI, SIAFI e Transferegov.",
    "5. Estatística — IBGE, INEP, DATASUS, Banco Central e IPEA.",
    "6. Informativa — cartilhas, painéis, notícias e publicações técnicas oficiais.",
    "",
    "ROTEIRO ESPECÍFICO DE PESQUISA:",
    ...resolution.researchChecklist.map((item, index) => `${index + 1}. ${item}`),
    "",
    "REGRAS DE USO DAS FONTES:",
    "- Prefira a fonte primária que cria, publica, registra ou decide a matéria.",
    "- Use fonte informativa somente como complemento, nunca para contrariar fonte normativa ou jurisdicional.",
    "- Não trate resultado de busca, resumo ou notícia como substituto do texto oficial do ato.",
    "- Não invente consulta, título, órgão, documento ou URL.",
    "- Se fontes oficiais divergirem, explique a diferença de competência, data, vigência ou contexto.",
    "- Se não localizar fonte oficial suficiente, declare que não foi possível validar a informação; não apresente dado atual como confirmado.",
    "- Na seção **Base legal:**, transforme o nome de cada norma efetivamente consultada em link Markdown para a página oficial correspondente.",
    "- Ao final, em **Fontes consultadas:**, liste somente fontes efetivamente utilizadas, sempre no formato Markdown [título oficial](URL oficial).",
    "- Não apresente domínio genérico quando houver link direto para a lei, decreto, decisão, manual, tabela ou página consultada.",
  ].join("\n");
}
