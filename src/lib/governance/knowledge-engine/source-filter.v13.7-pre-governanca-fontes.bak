import type { GovernanceQueryNature } from "./analyzer";

type GovernanceSource = {
  id?: string;
  title?: string | null;
  url?: string | null;
  type?: string | null;
};

type GovernanceSourceGroups<TSource extends GovernanceSource = GovernanceSource> = {
  institutional: TSource[];
  officialGazette: TSource[];
  officialSources: TSource[];
};

function normalizeForMatch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalizeForMatch(term)));
}

function sourceText(source: GovernanceSource) {
  return normalizeForMatch(`${source.title ?? ""} ${source.type ?? ""}`);
}

function uniqueSources<TSource extends GovernanceSource>(sources: TSource[]) {
  const unique = new Map<string, TSource>();

  for (const source of sources) {
    const title = normalizeForMatch(source.title);
    if (!title) continue;

    const url = String(source.url ?? "").trim();
    const key = `${title}::${url}`;

    if (!unique.has(key)) {
      unique.set(key, source);
    }
  }

  return Array.from(unique.values());
}

function isClearlyUnrelatedToLicitation(source: GovernanceSource) {
  const text = sourceText(source);

  return includesAny(text, [
    "estagiario",
    "estagiarios",
    "processo seletivo",
    "servidor municipal",
    "servidores municipais",
    "estatuto dos servidores",
    "magisterio",
    "plano de cargos",
    "plano diretor",
    "codigo tributario",
    "conselho municipal",
    "nomeacao",
    "exoneracao",
  ]);
}

function isLicitationRelated(source: GovernanceSource) {
  const text = sourceText(source);

  if (isClearlyUnrelatedToLicitation(source)) {
    return false;
  }

  return includesAny(text, [
    "licitacao",
    "licitacoes",
    "dispensa",
    "inexigibilidade",
    "pregao",
    "contratacao direta",
    "contrato",
    "aviso de dispensa",
    "processo administrativo",
    "proposta",
    "abertura da proposta",
    "edital de licitacao",
    "lei 14 133",
    "14 133",
  ]);
}

function isMunicipalRecordQuery(question: string) {
  const q = normalizeForMatch(question);

  return includesAny(q, [
    "informe",
    "liste",
    "relacione",
    "mostre",
    "quais",
    "publicadas",
    "publicados",
    "ocorreram",
    "mes",
    "janeiro",
    "fevereiro",
    "marco",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
    "diario oficial",
  ]);
}

function isOfficialGazettePublicationQuery(question: string) {
  const q = normalizeForMatch(question);

  return (
    includesAny(q, [
      "em qual diario oficial",
      "qual diario oficial",
      "diario oficial foi publicada",
      "diario oficial foi publicado",
      "onde foi publicada",
      "onde foi publicado",
      "publicacao da lei",
      "publicação da lei",
      "edicao do diario",
      "edição do diário",
      "numero da edicao",
      "número da edição",
    ]) &&
    includesAny(q, [
      "publicada",
      "publicado",
      "publicacao",
      "publicação",
      "diario oficial",
      "edição",
      "edicao",
    ])
  );
}


function isOrganicLawQuery(question: string) {
  const q = normalizeForMatch(question);

  return includesAny(q, [
    "lei organica",
    "lei orgânica",
    "constituicao do municipio",
    "constituição do município",
  ]);
}

function isPlanoDiretorQuery(question: string) {
  return includesAny(normalizeForMatch(question), ["plano diretor"]);
}

function isAdministrativeStructureQuery(question: string) {
  return includesAny(normalizeForMatch(question), [
    "estrutura administrativa",
    "organograma",
    "secretarias",
    "departamentos",
    "controladoria",
    "controle interno",
    "controladoria interna",
    "controlador interno",
  ]);
}

function isLaiQuery(question: string) {
  return includesAny(normalizeForMatch(question), [
    "lai",
    "lei de acesso",
    "acesso a informacao",
    "acesso à informação",
    "pedido de informacao",
    "pedido de informação",
    "sic",
    "e sic",
    "e-sic",
    "transparencia",
    "transparência",
  ]);
}

function isPersonnelExpenseQuery(question: string) {
  return includesAny(normalizeForMatch(question), [
    "despesa com pessoal",
    "limite de pessoal",
    "limite prudencial",
    "responsabilidade fiscal",
    "lrf",
    "receita corrente liquida",
    "receita corrente líquida",
    "rcl",
  ]);
}

function isOfficialSourcesQuery(question: string) {
  return includesAny(normalizeForMatch(question), [
    "fontes oficiais",
    "fonte oficial",
    "canais oficiais",
    "canal oficial",
    "site oficial",
    "diario oficial",
    "diário oficial",
    "documentos oficiais",
  ]);
}

function isOrganicLawSource(source: GovernanceSource) {
  return includesAny(sourceText(source), [
    "lei organica",
    "lei orgânica",
    "lei municipal 01 1990",
  ]);
}

function isPlanoDiretorSource(source: GovernanceSource) {
  return includesAny(sourceText(source), ["plano diretor"]);
}

function isAdministrativeStructureSource(source: GovernanceSource) {
  return includesAny(sourceText(source), [
    "estrutura administrativa",
    "organograma",
    "lei complementar 047 2024",
    "lei complementar 47 2024",
    "lei complementar 017 2013",
    "lei complementar 17 2013",
    "controladoria",
    "controle interno",
    "controladoria interna",
  ]);
}

function isLaiRelatedSource(source: GovernanceSource) {
  const text = sourceText(source);

  if (includesAny(text, [
    "edital",
    "extrato de contrato",
    "processo seletivo",
    "estagiario",
    "estagiarios",
    "nomeacao",
    "exoneracao",
    "plano diretor",
    "codigo tributario",
    "código tributário",
    "ata de posse",
  ])) {
    return false;
  }

  return includesAny(text, [
    "lei de acesso",
    "lai",
    "transparencia",
    "transparência",
    "portal transparencia",
    "portal transparência",
    "sic",
    "e sic",
    "e-sic",
    "lgpd",
    "lei geral de protecao de dados",
    "lei geral de proteção de dados",
  ]);
}

function isPersonnelExpenseRelatedSource(source: GovernanceSource) {
  const text = sourceText(source);

  if (includesAny(text, [
    "plano diretor",
    "lei organica",
    "lei orgânica",
    "plano de cargos",
    "carreira",
    "vencimentos",
    "estatuto dos servidores",
    "ata de posse",
    "codigo tributario",
    "código tributário",
  ])) {
    return false;
  }

  return includesAny(text, [
    "responsabilidade fiscal",
    "lrf",
    "despesa com pessoal",
    "limite prudencial",
    "relatorio de gestao fiscal",
    "relatório de gestão fiscal",
    "rgf",
    "rreo",
    "receita corrente liquida",
    "receita corrente líquida",
  ]);
}

function isCareerProgressionRelatedSource(source: GovernanceSource) {
  return includesAny(sourceText(source), [
    "plano de cargos",
    "carreira",
    "vencimentos",
    "progressao",
    "progressão",
    "magisterio",
    "magistério",
    "professor",
    "docente",
    "estatuto dos servidores",
  ]);
}
function isPersonnelRightsQuery(question: string) {
  return includesAny(normalizeForMatch(question), [
    "licenca premio",
    "licença prêmio",
    "licenca-premio",
    "licença-prêmio",
    "ferias",
    "férias",
    "remuneracao",
    "remuneração",
    "salario",
    "salário",
    "subsidio",
    "subsídio",
    "vencimento",
    "controlador interno",
    "controladoria interna",
  ]);
}

function isPersonnelRightsRelatedSource(source: GovernanceSource) {
  return includesAny(sourceText(source), [
    "estatuto dos servidores",
    "servidores municipais",
    "plano de cargos",
    "carreira",
    "vencimentos",
    "remuneracao",
    "remuneração",
    "licenca",
    "licença",
    "subsidios",
    "subsídios",
    "quadro de pessoal",
  ]);
}

function isCompensationOrPayrollVerificationQuery(question: string) {
  const q = normalizeForMatch(question);

  return includesAny(q, [
    "salario",
    "salário",
    "remuneracao",
    "remuneração",
    "subsidio",
    "subsídio",
    "vencimento",
    "vencimentos",
    "folha de pagamento",
    "folha",
    "pagamento do prefeito",
    "controlador interno",
    "controladoria interna",
  ]);
}

function isLicitationConsultationQuery(question: string) {
  const q = normalizeForMatch(question);

  return (
    includesAny(q, [
      "licitacao",
      "licitacoes",
      "licitação",
      "licitações",
      "dispensa",
      "inexigibilidade",
      "pregao",
      "pregão",
      "contrato",
      "contratos",
    ]) &&
    includesAny(q, [
      "onde",
      "consultar",
      "encontrar",
      "acessar",
      "buscar",
      "localizar",
      "portal",
      "transparencia",
      "transparência",
      "site",
      "fonte",
      "fontes",
    ])
  );
}

function isLicitationConsultationOfficialSource(source: GovernanceSource) {
  const text = sourceText(source);
  const url = normalizeForMatch(source.url);
  const haystack = `${text} ${url}`;

  return includesAny(haystack, [
    "portal transparencia",
    "portal transparência",
    "transparencia",
    "transparência",
    "betha",
    "betha contabil",
    "betha contábil",
    "licitacao",
    "licitações",
    "licitacoes",
    "contrato",
    "contratos",
    "diario oficial",
    "diário oficial",
    "site oficial",
  ]);
}

function filterOfficialSourcesForLicitationConsultation<TSource extends GovernanceSource>(sources: TSource[]) {
  const preferred = uniqueSources(sources).filter(isLicitationConsultationOfficialSource);

  if (preferred.length > 0) {
    return preferred.slice(0, 5);
  }

  return uniqueSources(sources).slice(0, 3);
}

function isTransparencyVerificationSource(source: GovernanceSource) {
  const text = sourceText(source);
  const url = normalizeForMatch(source.url);

  return includesAny(`${text} ${url}`, [
    "portal transparencia",
    "portal transparência",
    "transparencia",
    "transparência",
    "betha",
    "betha contabil",
    "betha contábil",
    "folha de pagamento",
    "servidores",
    "pessoal",
  ]);
}

function filterOfficialSourcesForCompensationVerification<TSource extends GovernanceSource>(sources: TSource[]) {
  const preferred = uniqueSources(sources).filter(isTransparencyVerificationSource);

  if (preferred.length > 0) {
    return preferred.slice(0, 4);
  }

  return uniqueSources(sources).slice(0, 3);
}


type TransparencyTopicRule = {
  name: string;
  questionTerms: string[];
  sourceTerms: string[];
  fallbackTerms?: string[];
  max?: number;
};

const TRANSPARENCY_TOPIC_RULES: TransparencyTopicRule[] = [
  {
    name: "portal_transparencia",
    questionTerms: [
      "portal transparencia",
      "portal da transparencia",
      "transparencia",
      "transparência",
      "dados abertos",
      "pntp",
      "programa nacional de transparencia publica",
      "programa nacional de transparência pública",
      "mapa do site",
      "perguntas frequentes",
      "glossario",
      "glossário",
    ],
    sourceTerms: [
      "portal transparencia",
      "portal da transparencia",
      "transparencia",
      "transparência",
      "betha",
      "betha contabil",
      "betha contábil",
      "dados abertos",
      "pntp",
      "perguntas frequentes",
      "glossario",
      "glossário",
      "mapa do site",
    ],
    fallbackTerms: ["portal transparencia", "transparência", "betha"],
    max: 6,
  },
  {
    name: "site_e_fontes_oficiais",
    questionTerms: [
      "site oficial",
      "fonte oficial",
      "fontes oficiais",
      "canais oficiais",
      "diario oficial",
      "diário oficial",
      "leis e atos",
      "atos administrativos",
      "lei municipal",
      "decreto municipal",
      "portaria",
      "horario de atendimento",
      "horário de atendimento",
      "camara municipal",
      "câmara municipal",
      "santanaprev",
      "politica de privacidade",
      "política de privacidade",
      "governo digital",
      "fala cidadao",
      "fala cidadão",
      "ouvidoria",
      "e sic",
      "e-sic",
      "sic",
    ],
    sourceTerms: [
      "site oficial",
      "diario oficial",
      "diário oficial",
      "leis e atos",
      "atos administrativos",
      "lei",
      "decreto",
      "portaria",
      "horario de atendimento",
      "horário de atendimento",
      "camara municipal",
      "câmara municipal",
      "santanaprev",
      "politica de privacidade",
      "política de privacidade",
      "governo digital",
      "fala cidadao",
      "fala cidadão",
      "ouvidoria",
      "e sic",
      "e-sic",
      "sic",
    ],
    fallbackTerms: ["site oficial", "diario oficial", "portal transparencia"],
    max: 6,
  },
  {
    name: "perfil_municipio",
    questionTerms: [
      "perfil do municipio",
      "perfil do município",
      "ibge",
      "ipardes",
      "populacao",
      "população",
      "dados do municipio",
      "dados do município",
      "indicadores municipais",
    ],
    sourceTerms: [
      "perfil do municipio",
      "perfil do município",
      "ibge",
      "ipardes",
      "populacao",
      "população",
      "indicadores",
    ],
    fallbackTerms: ["ibge", "ipardes"],
    max: 4,
  },
  {
    name: "estrutura_administrativa",
    questionTerms: [
      "estrutura administrativa",
      "organograma",
      "secretarias",
      "secretarios",
      "secretários",
      "controle interno",
      "controladoria",
      "carta de servicos",
      "carta de serviços",
      "frota",
      "veiculos",
      "veículos",
      "divida ativa",
      "dívida ativa",
      "progov",
    ],
    sourceTerms: [
      "estrutura administrativa",
      "organograma",
      "secretarias",
      "secretarios",
      "secretários",
      "controle interno",
      "controladoria",
      "carta de servicos",
      "carta de serviços",
      "frota",
      "veiculos",
      "veículos",
      "divida ativa",
      "dívida ativa",
      "progov",
    ],
    fallbackTerms: ["portal transparencia", "site oficial"],
    max: 6,
  },
  {
    name: "receitas_despesas_orcamento",
    questionTerms: [
      "receita",
      "receitas",
      "despesa",
      "despesas",
      "orcamento",
      "orçamento",
      "contas publicas",
      "contas públicas",
      "ppa",
      "loa",
      "ldo",
      "plano plurianual",
      "lei orcamentaria",
      "lei orçamentária",
      "diretrizes orcamentarias",
      "diretrizes orçamentárias",
      "rreo",
      "rgf",
      "relatorio de gestao fiscal",
      "relatório de gestão fiscal",
      "balanco",
      "balanço",
      "empenho",
      "empenhos",
      "restos a pagar",
      "transferencias financeiras",
      "transferências financeiras",
      "operacoes de credito",
      "operações de crédito",
      "riscos fiscais",
      "razao contabil",
      "razão contábil",
      "bancos",
      "movimentacao bancaria",
      "movimentação bancária",
      "audiencias publicas",
      "audiências públicas",
    ],
    sourceTerms: [
      "receita",
      "receitas",
      "despesa",
      "despesas",
      "orcamento",
      "orçamento",
      "contas publicas",
      "contas públicas",
      "ppa",
      "loa",
      "ldo",
      "plano plurianual",
      "orcamentaria",
      "orçamentária",
      "rreo",
      "rgf",
      "gestao fiscal",
      "gestão fiscal",
      "balanco",
      "balanço",
      "empenho",
      "restos a pagar",
      "transferencias",
      "transferências",
      "operacoes de credito",
      "operações de crédito",
      "riscos fiscais",
      "razao contabil",
      "razão contábil",
      "movimentacao bancaria",
      "movimentação bancária",
      "audiencias publicas",
      "audiências públicas",
      "betha",
    ],
    fallbackTerms: ["portal transparencia", "betha"],
    max: 8,
  },
  {
    name: "licitacoes_contratos_compras",
    questionTerms: [
      "licitacao",
      "licitações",
      "licitacoes",
      "dispensa",
      "inexigibilidade",
      "pregao",
      "pregão",
      "contrato",
      "contratos",
      "aditivo",
      "aditivos",
      "compras diretas",
      "chamada publica",
      "chamada pública",
      "ata de registro",
      "registro de precos",
      "registro de preços",
      "srp",
      "fornecedores sancionados",
      "plano anual de compras",
      "fiscais de contratos",
      "estoque",
      "controle de estoque",
      "obras publicas",
      "obras públicas",
      "obras paralisadas",
    ],
    sourceTerms: [
      "licitacao",
      "licitações",
      "licitacoes",
      "dispensa",
      "inexigibilidade",
      "pregao",
      "pregão",
      "contrato",
      "contratos",
      "aditivo",
      "aditivos",
      "compras diretas",
      "chamada publica",
      "chamada pública",
      "ata de registro",
      "registro de precos",
      "registro de preços",
      "srp",
      "fornecedores sancionados",
      "plano anual de compras",
      "fiscais de contratos",
      "controle de estoque",
      "obras publicas",
      "obras públicas",
      "obras paralisadas",
      "diario oficial",
      "diário oficial",
      "betha",
    ],
    fallbackTerms: ["portal transparencia", "betha", "diario oficial"],
    max: 8,
  },
  {
    name: "servidores_folha_remuneracao",
    questionTerms: [
      "servidores",
      "servidor",
      "ativos",
      "temporarios",
      "temporários",
      "inativos",
      "cedidos",
      "folha de pagamento",
      "remuneracao",
      "remuneração",
      "salario",
      "salário",
      "subsidio",
      "subsídio",
      "vencimento",
      "vencimentos",
      "agentes politicos",
      "agentes políticos",
      "tabela de remuneracoes",
      "tabela de remunerações",
      "horario e local de trabalho",
      "horário e local de trabalho",
      "diarias",
      "diárias",
      "viagens",
      "adiantamento",
      "adiantamentos",
      "reembolso",
      "reembolsos",
      "cartao corporativo",
      "cartão corporativo",
      "concurso",
      "processo seletivo",
      "terceirizados",
      "estagiarios",
      "estagiários",
    ],
    sourceTerms: [
      "servidores",
      "servidor",
      "ativos",
      "temporarios",
      "temporários",
      "inativos",
      "cedidos",
      "folha de pagamento",
      "remuneracao",
      "remuneração",
      "salario",
      "salário",
      "subsidio",
      "subsídio",
      "vencimento",
      "vencimentos",
      "agentes politicos",
      "agentes políticos",
      "tabela de remuneracoes",
      "tabela de remunerações",
      "horario e local de trabalho",
      "horário e local de trabalho",
      "diarias",
      "diárias",
      "viagens",
      "adiantamento",
      "reembolsos",
      "cartao corporativo",
      "cartão corporativo",
      "concurso",
      "processo seletivo",
      "terceirizados",
      "estagiarios",
      "estagiários",
      "betha",
    ],
    fallbackTerms: ["portal transparencia", "betha", "folha de pagamento", "servidores"],
    max: 8,
  },
  {
    name: "convenios_repasses_emendas",
    questionTerms: [
      "convenio",
      "convênio",
      "convenios",
      "convênios",
      "repasses",
      "parceria",
      "parcerias",
      "emenda parlamentar",
      "emendas parlamentares",
      "emenda pix",
      "emendas pix",
      "governo federal",
      "governo estadual",
      "transferencia",
      "transferência",
      "transferencias",
      "transferências",
      "acordos sem transferencia",
      "acordos sem transferência",
    ],
    sourceTerms: [
      "convenio",
      "convênio",
      "convenios",
      "convênios",
      "repasses",
      "parceria",
      "parcerias",
      "emenda parlamentar",
      "emendas parlamentares",
      "emenda pix",
      "emendas pix",
      "governo federal",
      "governo estadual",
      "transferencia",
      "transferência",
      "transferencias",
      "transferências",
      "acordos",
    ],
    fallbackTerms: ["portal transparencia", "betha"],
    max: 7,
  },
  {
    name: "educacao",
    questionTerms: [
      "educacao",
      "educação",
      "plano municipal de educacao",
      "plano municipal de educação",
      "conselho municipal de educacao",
      "conselho municipal de educação",
      "fundeb",
      "cacs",
      "pme",
      "prestacao de contas educacao",
      "prestação de contas educação",
      "vagas existentes",
      "lista de espera",
      "cardapio escolar",
      "cardápio escolar",
      "fnde",
      "liberacoes",
      "liberações",
      "resolucoes",
      "resoluções",
    ],
    sourceTerms: [
      "educacao",
      "educação",
      "plano municipal de educacao",
      "plano municipal de educação",
      "conselho municipal de educacao",
      "conselho municipal de educação",
      "fundeb",
      "cacs",
      "pme",
      "prestacao de contas",
      "prestação de contas",
      "vagas",
      "lista de espera",
      "cardapio escolar",
      "cardápio escolar",
      "fnde",
      "liberacoes",
      "liberações",
      "resolucoes",
      "resoluções",
    ],
    fallbackTerms: ["portal transparencia", "educacao"],
    max: 7,
  },
  {
    name: "saude",
    questionTerms: [
      "saude",
      "saúde",
      "plano municipal de saude",
      "plano municipal de saúde",
      "conselho municipal de saude",
      "conselho municipal de saúde",
      "programacao anual de saude",
      "programação anual de saúde",
      "relatorio anual de gestao",
      "relatório anual de gestão",
      "receitas e despesas saude",
      "receitas e despesas saúde",
      "escala profissionais",
      "horario atendimento profissionais",
      "horário atendimento profissionais",
      "covid",
      "remume",
      "estoque de medicamentos",
      "medicamentos",
      "ubs",
      "farmacia",
      "farmácia",
      "ceaf",
      "fila de espera",
      "pesquisa de satisfacao",
      "pesquisa de satisfação",
    ],
    sourceTerms: [
      "saude",
      "saúde",
      "plano municipal de saude",
      "plano municipal de saúde",
      "conselho municipal de saude",
      "conselho municipal de saúde",
      "programacao anual",
      "programação anual",
      "relatorio anual de gestao",
      "relatório anual de gestão",
      "receitas e despesas",
      "escala profissionais",
      "covid",
      "remume",
      "estoque de medicamentos",
      "medicamentos",
      "ubs",
      "farmacia",
      "farmácia",
      "ceaf",
      "fila de espera",
      "pesquisa de satisfacao",
      "pesquisa de satisfação",
    ],
    fallbackTerms: ["portal transparencia", "saude"],
    max: 7,
  },
  {
    name: "assistencia_social",
    questionTerms: [
      "assistencia social",
      "assistência social",
      "plano municipal de assistencia social",
      "plano municipal de assistência social",
      "pessoa com deficiencia",
      "pessoa com deficiência",
      "socioeducativo",
      "cmas",
      "bolsa familia",
      "bolsa família",
      "protocolos de servicos",
      "protocolos de serviços",
    ],
    sourceTerms: [
      "assistencia social",
      "assistência social",
      "plano municipal de assistencia social",
      "plano municipal de assistência social",
      "pessoa com deficiencia",
      "pessoa com deficiência",
      "socioeducativo",
      "cmas",
      "bolsa familia",
      "bolsa família",
      "protocolos de servicos",
      "protocolos de serviços",
    ],
    fallbackTerms: ["portal transparencia", "assistencia social"],
    max: 6,
  },
  {
    name: "prestacao_contas_controle",
    questionTerms: [
      "prestacao de contas",
      "prestação de contas",
      "parecer do legislativo",
      "parecer do tce",
      "tce pr",
      "tce-pr",
      "controle interno",
      "ministerio publico",
      "ministério público",
      "recomendacao do ministerio publico",
      "recomendação do ministério público",
      "relatorio de gestao e atividades",
      "relatório de gestão e atividades",
      "plano estrategico institucional",
      "plano estratégico institucional",
    ],
    sourceTerms: [
      "prestacao de contas",
      "prestação de contas",
      "parecer do legislativo",
      "parecer do tce",
      "tce",
      "controle interno",
      "ministerio publico",
      "ministério público",
      "recomendacao",
      "recomendação",
      "relatorio de gestao",
      "relatório de gestão",
      "plano estrategico",
      "plano estratégico",
    ],
    fallbackTerms: ["portal transparencia", "controle interno", "tce"],
    max: 7,
  },
];

function getTransparencyTopicMatches(question: string) {
  const q = normalizeForMatch(question);

  return TRANSPARENCY_TOPIC_RULES.filter((rule) =>
    includesAny(q, rule.questionTerms),
  );
}

function isTransparencyPortalSource(source: GovernanceSource) {
  const haystack = `${sourceText(source)} ${normalizeForMatch(source.url)}`;

  return includesAny(haystack, [
    "portal transparencia",
    "portal da transparencia",
    "portal transparência",
    "portal da transparência",
    "transparencia",
    "transparência",
    "betha",
    "betha contabil",
    "betha contábil",
  ]);
}

function filterOfficialSourcesForTransparencyTopic<TSource extends GovernanceSource>(
  sources: TSource[],
  question: string,
) {
  const unique = uniqueSources(sources);
  const matchedRules = getTransparencyTopicMatches(question);

  if (matchedRules.length === 0) {
    return [];
  }

  const ranked = unique
    .map((source) => {
      const haystack = `${sourceText(source)} ${normalizeForMatch(source.url)}`;
      let score = 0;

      for (const rule of matchedRules) {
        if (includesAny(haystack, rule.sourceTerms)) {
          score += 100;
        }

        if (rule.fallbackTerms && includesAny(haystack, rule.fallbackTerms)) {
          score += 45;
        }
      }

      if (isTransparencyPortalSource(source)) {
        score += 30;
      }

      return { source, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.source);

  if (ranked.length > 0) {
    const max = Math.max(...matchedRules.map((rule) => rule.max ?? 6));
    return uniqueSources(ranked).slice(0, max);
  }

  return unique.filter(isTransparencyPortalSource).slice(0, 4);
}

function mergeOfficialSourceSets<TSource extends GovernanceSource>(...sets: TSource[][]) {
  return uniqueSources(sets.flat()).slice(0, 8);
}

function isOfficialSourceEvidence(source: GovernanceSource) {
  return includesAny(sourceText(source), [
    "ata de posse",
    "diario oficial",
    "diário oficial",
    "site oficial",
    "portal",
    "transparencia",
    "transparência",
    "codigo tributario",
    "código tributário",
    "fontes oficiais",
  ]);
}

function filterMunicipalSources<TSource extends GovernanceSource>(
  sources: TSource[],
  question: string,
) {
  const q = normalizeForMatch(question);
  const unique = uniqueSources(sources);

  if (includesAny(q, ["licitacao", "licitacoes", "dispensa", "inexigibilidade", "pregao", "contratacao"])) {
    return unique.filter(isLicitationRelated).slice(0, 8);
  }

  const organicLawQuery = isOrganicLawQuery(question);
  const planoDiretorQuery = isPlanoDiretorQuery(question);
  const administrativeStructureQuery = isAdministrativeStructureQuery(question);

  if (organicLawQuery && planoDiretorQuery && administrativeStructureQuery) {
    return unique
      .filter((source) =>
        isOrganicLawSource(source) ||
        isPlanoDiretorSource(source) ||
        isAdministrativeStructureSource(source)
      )
      .slice(0, 8);
  }

  if (organicLawQuery && planoDiretorQuery) {
    return unique
      .filter((source) => isOrganicLawSource(source) || isPlanoDiretorSource(source))
      .slice(0, 6);
  }

  if (organicLawQuery && administrativeStructureQuery) {
    return unique
      .filter((source) => isOrganicLawSource(source) || isAdministrativeStructureSource(source))
      .slice(0, 6);
  }

  if (planoDiretorQuery && administrativeStructureQuery) {
    return unique
      .filter((source) => isPlanoDiretorSource(source) || isAdministrativeStructureSource(source))
      .slice(0, 6);
  }

  if (organicLawQuery) {
    return unique.filter(isOrganicLawSource).slice(0, 3);
  }

  if (planoDiretorQuery) {
    return unique.filter(isPlanoDiretorSource).slice(0, 3);
  }

  if (administrativeStructureQuery) {
    return unique.filter(isAdministrativeStructureSource).slice(0, 3);
  }

  if (isLaiQuery(question)) {
    return unique.filter(isLaiRelatedSource).slice(0, 4);
  }

  if (isPersonnelExpenseQuery(question)) {
    return unique.filter(isPersonnelExpenseRelatedSource).slice(0, 3);
  }

  if (isCareerProgressionRelatedSource({ title: question, type: null, url: null })) {
    return unique.filter(isCareerProgressionRelatedSource).slice(0, 4);
  }

  if (isPersonnelRightsQuery(question)) {
    return unique.filter(isPersonnelRightsRelatedSource).slice(0, 4);
  }

  if (isOfficialSourcesQuery(question)) {
    return unique.filter(isOfficialSourceEvidence).slice(0, 5);
  }

  if (isMunicipalRecordQuery(question)) {
    return unique.slice(0, 8);
  }

  return unique.filter((source) => {
    const title = normalizeForMatch(source.title);
    return title && normalizeForMatch(question).includes(title);
  }).slice(0, 5);
}

export function filterGovernanceSourcesForResponse<TSource extends GovernanceSource>(params: {
  sources: GovernanceSourceGroups<TSource>;
  question: string;
  queryNature: GovernanceQueryNature;
}): GovernanceSourceGroups<TSource> {
  const sources = params.sources;
  const officialGazetteSources = uniqueSources(sources.officialGazette ?? []);
  const transparencyTopicOfficialSources = filterOfficialSourcesForTransparencyTopic(
    sources.officialSources ?? [],
    params.question,
  );

  function resolveOfficialSourcesForQuestion(fallback: TSource[] = []) {
    if (isCompensationOrPayrollVerificationQuery(params.question)) {
      return mergeOfficialSourceSets(
        filterOfficialSourcesForCompensationVerification(sources.officialSources ?? []),
        transparencyTopicOfficialSources,
      );
    }

    if (isLicitationConsultationQuery(params.question)) {
      return mergeOfficialSourceSets(
        filterOfficialSourcesForLicitationConsultation(sources.officialSources ?? []),
        transparencyTopicOfficialSources,
      );
    }

    if (transparencyTopicOfficialSources.length > 0) {
      return mergeOfficialSourceSets(transparencyTopicOfficialSources, fallback);
    }

    return fallback;
  }

  if (isOfficialGazettePublicationQuery(params.question) && officialGazetteSources.length > 0) {
    return {
      institutional: [],
      officialGazette: officialGazetteSources.slice(0, 4),
      officialSources: [],
    };
  }

  if (params.queryNature === "legal_general") {
    return {
      institutional: [],
      officialGazette: [],
      officialSources: [],
    };
  }

  if (params.queryNature === "institutional") {
    const institutional = filterMunicipalSources(sources.institutional ?? [], params.question);
    const officialGazette = filterMunicipalSources(sources.officialGazette ?? [], params.question);

    return {
      institutional,
      officialGazette,
      officialSources: resolveOfficialSourcesForQuestion(
        isLaiQuery(params.question) || isPersonnelExpenseQuery(params.question)
          ? uniqueSources(sources.officialSources ?? []).slice(0, 3)
          : [],
      ),
    };
  }

  if (params.queryNature === "municipal_records") {
    return {
      institutional: filterMunicipalSources(sources.institutional ?? [], params.question),
      officialGazette: filterMunicipalSources(sources.officialGazette ?? [], params.question),
      officialSources: resolveOfficialSourcesForQuestion([]),
    };
  }

  return {
    institutional: filterMunicipalSources(sources.institutional ?? [], params.question),
    officialGazette: filterMunicipalSources(sources.officialGazette ?? [], params.question),
    officialSources: resolveOfficialSourcesForQuestion(
      uniqueSources(sources.officialSources ?? []).slice(0, 3),
    ),
  };
}
