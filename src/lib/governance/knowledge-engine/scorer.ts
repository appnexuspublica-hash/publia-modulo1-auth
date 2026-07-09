import { analyzeGovernanceQuery } from "./analyzer";
import { getExactQuestionPhrases, getGovernanceSearchTokens, normalizeGovernanceText } from "./normalize";
import type {
  GovernanceKnowledgeItem,
  GovernanceKnowledgeProvider,
  GovernanceKnowledgeScoreResult,
} from "./types";

type ScoreParams = {
  question: string;
  provider: GovernanceKnowledgeProvider;
  title: string;
  body: string;
  type?: string | null;
  url?: string | null;
  recencyDate?: string | null;
};

type TopicProfile = {
  positive: RegExp[];
  negative: RegExp[];
  preferredProviders: GovernanceKnowledgeProvider[];
  preferredTypes: RegExp[];
  requiresDirectEvidence: boolean;
};

const LEGAL_TOPICS = new Set(["lai", "lrf_personnel_expense"]);

function countMatches(haystack: string, tokens: string[]) {
  let count = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      count += 1;
    }
  }

  return count;
}

function uniqueTokens(tokens: string[]) {
  return Array.from(new Set(tokens.filter((token) => token.length >= 3)));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function isCompensationOrPayrollQuestion(question: string) {
  return /\b(salario|salário|remuneracao|remuneração|subsidio|subsídio|vencimento|vencimentos|folha|folha de pagamento|contracheque|holerite|controlador interno|controladoria interna|prefeito)\b/i.test(
    question,
  ) && /\b(salario|salário|remuneracao|remuneração|subsidio|subsídio|vencimento|vencimentos|folha|pagamento)\b/i.test(
    question,
  );
}

function isTransparencyOfficialSourceText(text: string) {
  return /\b(transparencia|transparência|portal da transparencia|portal da transparência|betha|betha contabil|betha contábil|folha de pagamento|servidores|pessoal)\b/.test(text);
}


type TransparencyTopicRule = {
  question: RegExp[];
  source: RegExp[];
  evidence: string;
};

const TRANSPARENCY_TOPIC_RULES: TransparencyTopicRule[] = [
  {
    question: [
      /portal da? transparencia|portal da? transparência|transparencia|transparência|dados abertos|pntp|mapa do site|perguntas frequentes|glossario|glossário/,
    ],
    source: [
      /portal da? transparencia|portal da? transparência|transparencia|transparência|betha|dados abertos|pntp|mapa do site|perguntas frequentes|glossario|glossário/,
    ],
    evidence: "fonte oficial do Portal da Transparência para o assunto",
  },
  {
    question: [
      /site oficial|fonte oficial|fontes oficiais|canais oficiais|diario oficial|diário oficial|leis e atos|atos administrativos|horario de atendimento|horário de atendimento|camara municipal|câmara municipal|santanaprev|politica de privacidade|política de privacidade|governo digital|fala cidadao|fala cidadão|ouvidoria|e-?sic|\bsic\b/,
    ],
    source: [
      /site oficial|diario oficial|diário oficial|leis e atos|atos administrativos|horario de atendimento|horário de atendimento|camara municipal|câmara municipal|santanaprev|politica de privacidade|política de privacidade|governo digital|fala cidadao|fala cidadão|ouvidoria|e-?sic|\bsic\b|portal da? transparencia|portal da? transparência/,
    ],
    evidence: "fonte oficial institucional para consulta pública",
  },
  {
    question: [
      /perfil do municipio|perfil do município|ibge|ipardes|populacao|população|dados do municipio|dados do município|indicadores municipais/,
    ],
    source: [
      /perfil do municipio|perfil do município|ibge|ipardes|populacao|população|indicadores/,
    ],
    evidence: "fonte oficial de perfil e indicadores do município",
  },
  {
    question: [
      /estrutura administrativa|organograma|secretarias|secretarios|secretários|controle interno|controladoria|carta de servicos|carta de serviços|frota|veiculos|veículos|divida ativa|dívida ativa|progov/,
    ],
    source: [
      /estrutura administrativa|organograma|secretarias|secretarios|secretários|controle interno|controladoria|carta de servicos|carta de serviços|frota|veiculos|veículos|divida ativa|dívida ativa|progov|portal da? transparencia|portal da? transparência/,
    ],
    evidence: "fonte oficial de estrutura administrativa e serviços",
  },
  {
    question: [
      /receita|receitas|despesa|despesas|orcamento|orçamento|contas publicas|contas públicas|\bppa\b|\bloa\b|\bldo\b|plano plurianual|lei orcamentaria|lei orçamentária|diretrizes orcamentarias|diretrizes orçamentárias|\brreo\b|\brgf\b|gestao fiscal|gestão fiscal|balanco|balanço|empenho|restos a pagar|transferencias financeiras|transferências financeiras|operacoes de credito|operações de crédito|riscos fiscais|razao contabil|razão contábil|movimentacao bancaria|movimentação bancária|audiencias publicas|audiências públicas/,
    ],
    source: [
      /receita|receitas|despesa|despesas|orcamento|orçamento|contas publicas|contas públicas|\bppa\b|\bloa\b|\bldo\b|orcamentaria|orçamentária|\brreo\b|\brgf\b|gestao fiscal|gestão fiscal|balanco|balanço|empenho|restos a pagar|transferencias|transferências|operacoes de credito|operações de crédito|riscos fiscais|razao contabil|razão contábil|movimentacao bancaria|movimentação bancária|audiencias publicas|audiências públicas|betha|portal da? transparencia|portal da? transparência/,
    ],
    evidence: "fonte oficial de orçamento, receitas, despesas e contas públicas",
  },
  {
    question: [
      /licitacao|licitação|licitacoes|licitações|dispensa|inexigibilidade|pregao|pregão|contrato|contratos|aditivo|aditivos|compras diretas|chamada publica|chamada pública|registro de precos|registro de preços|\bsrp\b|fornecedores sancionados|plano anual de compras|fiscais de contratos|controle de estoque|obras publicas|obras públicas|obras paralisadas/,
    ],
    source: [
      /licitacao|licitação|licitacoes|licitações|dispensa|inexigibilidade|pregao|pregão|contrato|contratos|aditivo|aditivos|compras diretas|chamada publica|chamada pública|registro de precos|registro de preços|\bsrp\b|fornecedores sancionados|plano anual de compras|fiscais de contratos|controle de estoque|obras publicas|obras públicas|obras paralisadas|diario oficial|diário oficial|betha|portal da? transparencia|portal da? transparência/,
    ],
    evidence: "fonte oficial de licitações, compras e contratos",
  },
  {
    question: [
      /servidor|servidores|ativos|temporarios|temporários|inativos|cedidos|folha de pagamento|remuneracao|remuneração|salario|salário|subsidio|subsídio|vencimento|vencimentos|agentes politicos|agentes políticos|tabela de remuneracoes|tabela de remunerações|horario e local de trabalho|horário e local de trabalho|diarias|diárias|viagens|adiantamento|adiantamentos|reembolso|reembolsos|cartao corporativo|cartão corporativo|concurso|processo seletivo|terceirizados|estagiarios|estagiários/,
    ],
    source: [
      /servidor|servidores|ativos|temporarios|temporários|inativos|cedidos|folha de pagamento|remuneracao|remuneração|salario|salário|subsidio|subsídio|vencimento|vencimentos|agentes politicos|agentes políticos|tabela de remuneracoes|tabela de remunerações|horario e local de trabalho|horário e local de trabalho|diarias|diárias|viagens|adiantamento|reembolsos|cartao corporativo|cartão corporativo|concurso|processo seletivo|terceirizados|estagiarios|estagiários|betha|portal da? transparencia|portal da? transparência/,
    ],
    evidence: "fonte oficial de pessoal, folha, remuneração e servidores",
  },
  {
    question: [
      /convenio|convênio|convenios|convênios|repasses|parceria|parcerias|emenda parlamentar|emendas parlamentares|emenda pix|emendas pix|governo federal|governo estadual|transferencia|transferência|transferencias|transferências|acordos/,
    ],
    source: [
      /convenio|convênio|convenios|convênios|repasses|parceria|parcerias|emenda parlamentar|emendas parlamentares|emenda pix|emendas pix|governo federal|governo estadual|transferencia|transferência|transferencias|transferências|acordos|portal da? transparencia|portal da? transparência|betha/,
    ],
    evidence: "fonte oficial de convênios, repasses e emendas",
  },
  {
    question: [
      /educacao|educação|plano municipal de educacao|plano municipal de educação|conselho municipal de educacao|conselho municipal de educação|fundeb|\bcacs\b|\bpme\b|prestacao de contas educacao|prestação de contas educação|vagas existentes|lista de espera|cardapio escolar|cardápio escolar|fnde|liberacoes|liberações|resolucoes|resoluções/,
    ],
    source: [
      /educacao|educação|plano municipal de educacao|plano municipal de educação|conselho municipal de educacao|conselho municipal de educação|fundeb|\bcacs\b|\bpme\b|prestacao de contas|prestação de contas|vagas|lista de espera|cardapio escolar|cardápio escolar|fnde|liberacoes|liberações|resolucoes|resoluções|portal da? transparencia|portal da? transparência/,
    ],
    evidence: "fonte oficial de educação",
  },
  {
    question: [
      /saude|saúde|plano municipal de saude|plano municipal de saúde|conselho municipal de saude|conselho municipal de saúde|programacao anual de saude|programação anual de saúde|relatorio anual de gestao|relatório anual de gestão|receitas e despesas saude|receitas e despesas saúde|escala profissionais|horario atendimento profissionais|horário atendimento profissionais|covid|remume|estoque de medicamentos|medicamentos|\bubs\b|farmacia|farmácia|\bceaf\b|fila de espera|pesquisa de satisfacao|pesquisa de satisfação/,
    ],
    source: [
      /saude|saúde|plano municipal de saude|plano municipal de saúde|conselho municipal de saude|conselho municipal de saúde|programacao anual|programação anual|relatorio anual de gestao|relatório anual de gestão|receitas e despesas|escala profissionais|covid|remume|estoque de medicamentos|medicamentos|\bubs\b|farmacia|farmácia|\bceaf\b|fila de espera|pesquisa de satisfacao|pesquisa de satisfação|portal da? transparencia|portal da? transparência/,
    ],
    evidence: "fonte oficial de saúde",
  },
  {
    question: [
      /assistencia social|assistência social|plano municipal de assistencia social|plano municipal de assistência social|pessoa com deficiencia|pessoa com deficiência|socioeducativo|\bcmas\b|bolsa familia|bolsa família|protocolos de servicos|protocolos de serviços/,
    ],
    source: [
      /assistencia social|assistência social|plano municipal de assistencia social|plano municipal de assistência social|pessoa com deficiencia|pessoa com deficiência|socioeducativo|\bcmas\b|bolsa familia|bolsa família|protocolos de servicos|protocolos de serviços|portal da? transparencia|portal da? transparência/,
    ],
    evidence: "fonte oficial de assistência social",
  },
  {
    question: [
      /prestacao de contas|prestação de contas|parecer do legislativo|parecer do tce|tce-?pr|controle interno|ministerio publico|ministério público|recomendacao|recomendação|relatorio de gestao e atividades|relatório de gestão e atividades|plano estrategico institucional|plano estratégico institucional/,
    ],
    source: [
      /prestacao de contas|prestação de contas|parecer do legislativo|parecer do tce|\btce\b|controle interno|ministerio publico|ministério público|recomendacao|recomendação|relatorio de gestao|relatório de gestão|plano estrategico|plano estratégico|portal da? transparencia|portal da? transparência/,
    ],
    evidence: "fonte oficial de prestação de contas e controle",
  },
];

function getTransparencyTopicOfficialSourceBoost(question: string, sourceText: string) {
  let boost = 0;
  const evidence: string[] = [];

  for (const rule of TRANSPARENCY_TOPIC_RULES) {
    const questionMatches = hasAny(question, rule.question);
    const sourceMatches = hasAny(sourceText, rule.source);

    if (questionMatches && sourceMatches) {
      boost += 165;
      evidence.push(rule.evidence);
    }
  }

  return {
    boost,
    evidence,
  };
}

function getProviderWeight(provider: GovernanceKnowledgeProvider, topic: string) {
  if (topic === "current_mayor" || topic === "current_vice_mayor" || topic === "administrative_structure") {
    if (provider === "institutional") return 22;
    if (provider === "official_gazette") return 18;
    return 4;
  }

  if (LEGAL_TOPICS.has(topic)) {
    if (provider === "official_sources") return 24;
    if (provider === "institutional") return 14;
    if (provider === "official_gazette") return 8;
  }

  if (provider === "institutional") return 14;
  if (provider === "official_gazette") return 10;
  return 6;
}

function getAuthorityWeight(provider: GovernanceKnowledgeProvider, title: string, type: string, url?: string | null) {
  const text = `${title} ${type}`;
  let weight = 0;

  if (provider === "official_sources") weight += 20;
  if (provider === "institutional") weight += 12;
  if (provider === "official_gazette") weight += 10;

  if (/\.gov\.br|planalto\.gov\.br|senado\.leg\.br|camara\.leg\.br|tse\.jus\.br|tce|mppr|mprj|mp[a-z]{2}/.test(url ?? "")) {
    weight += 18;
  }

  if (/diario oficial|diário oficial|publicacao oficial|publicação oficial/.test(text)) weight += 12;
  if (/lei federal|constituicao federal|constituição federal|lei complementar federal|norma federal/.test(text)) weight += 16;
  if (/lei municipal|lei complementar municipal|decreto municipal|portaria municipal|ato oficial/.test(text)) weight += 12;
  if (/ata de posse|sessao solene de posse|sessão solene de posse|diplomacao|diplomação/.test(text)) weight += 18;

  return weight;
}

function getTypeWeight(type: string, title: string, topic: string) {
  const text = `${title} ${type}`;

  if (topic === "current_mayor" || topic === "current_vice_mayor") {
    if (/ata de posse|sessao solene de posse|sessão solene de posse|diploma|diplomacao|diplomação/.test(text)) return 44;
    if (/diario oficial|diário oficial/.test(text)) return 26;
    if (/lei|codigo|código|plano diretor|tributario|tributário/.test(text)) return -60;
  }

  if (topic === "administrative_structure") {
    if (/estrutura administrativa|reforma administrativa|organizacao administrativa|organização administrativa/.test(text)) return 38;
    if (/lei complementar|lei municipal|decreto/.test(text)) return 20;
    if (/plano diretor|codigo tributario|código tributário|ata de posse/.test(text)) return -45;
  }

  if (topic === "lai") {
    if (/lei de acesso|acesso a informacao|acesso à informação|transparencia|transparência|lei federal|fonte oficial/.test(text)) return 42;
    if (/plano diretor|codigo tributario|código tributário|ata de posse|posse/.test(text)) return -70;
  }

  if (topic === "lrf_personnel_expense") {
    if (/responsabilidade fiscal|lrf|despesa com pessoal|lei complementar|lei federal|fonte oficial/.test(text)) return 42;
    if (/plano diretor|ata de posse|posse|codigo tributario|código tributário/.test(text)) return -70;
  }

  if (topic === "magisterio_career") {
    if (/magisterio|magistério|professor|docente|educacao|educação|plano de cargos|carreira/.test(text)) return 40;
    if (/plano diretor|codigo tributario|código tributário|lei organica|lei orgânica|ata de posse/.test(text)) return -70;
  }

  if (topic === "career_progression") {
    if (/plano de cargos|pccs|carreira|progressao|progressão|vencimento|servidor/.test(text)) return 34;
    if (/plano diretor|codigo tributario|código tributário|lei organica|lei orgânica|ata de posse/.test(text)) return -55;
  }

  if (/ata de posse|diploma|diplomacao|diplomação/.test(text)) return 26;
  if (/lei complementar|complementar/.test(text)) return 14;
  if (/estatuto|plano de cargos|pccs|organica|orgânica/.test(text)) return 12;
  if (/lei ordinaria|lei municipal|lei estadual|lei/.test(text)) return 10;
  if (/decreto|portaria|ato|edital/.test(text)) return 7;
  if (/plano diretor|codigo tributario|código tributário/.test(text)) return 3;

  return 0;
}

function getRecencyWeight(value: string | null | undefined, topic: string) {
  if (!value) return 0;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;

  const ageDays = Math.max(0, (Date.now() - date.getTime()) / 86400000);

  if (topic === "current_mayor" || topic === "current_vice_mayor" || topic === "administrative_structure") {
    if (ageDays <= 120) return 30;
    if (ageDays <= 365) return 24;
    if (ageDays <= 365 * 2) return 16;
    if (ageDays <= 365 * 4) return 8;
    return -16;
  }

  if (ageDays <= 365) return 10;
  if (ageDays <= 365 * 3) return 6;
  if (ageDays <= 365 * 6) return 2;
  return 0;
}

function hasCurrentMandateEvidence(text: string) {
  return (
    /ata de posse/.test(text) ||
    /sessao solene de posse/.test(text) ||
    /sessão solene de posse/.test(text) ||
    /diplomacao|diplomação/.test(text) ||
    /gestao 2025|gestão 2025|2025\s*(?:a|-|\/)\s*2028/.test(text) ||
    /prefeito e vice/.test(text)
  );
}

function getTopicProfile(topic: string): TopicProfile {
  if (topic === "current_mayor" || topic === "current_vice_mayor") {
    return {
      positive: [
        /ata de posse/,
        /sessao solene de posse|sessão solene de posse/,
        /diplomacao|diplomação/,
        /gestao 2025|gestão 2025|2025\s*(?:a|-|\/)\s*2028/,
        /prefeito|vice-prefeito|vice prefeito/,
      ],
      negative: [
        /plano diretor/,
        /codigo tributario|código tributário/,
        /iptu|iss|itbi/,
        /zoneamento|uso do solo/,
        /lei organica|lei orgânica/,
      ],
      preferredProviders: ["institutional", "official_gazette"],
      preferredTypes: [/ata de posse/, /diario oficial|diário oficial/, /diplomacao|diplomação/],
      requiresDirectEvidence: true,
    };
  }

  if (topic === "administrative_structure") {
    return {
      positive: [
        /estrutura administrativa/,
        /organizacao administrativa|organização administrativa/,
        /administracao direta|administração direta/,
        /secretaria municipal|secretarias municipais/,
        /departamento municipal|departamentos municipais/,
        /organograma/,
      ],
      negative: [
        /plano diretor/,
        /codigo tributario|código tributário/,
        /ata de posse/,
        /diplomacao|diplomação/,
        /iptu|iss|itbi/,
        /zoneamento|uso do solo/,
      ],
      preferredProviders: ["institutional", "official_gazette"],
      preferredTypes: [/estrutura administrativa/, /lei complementar/, /lei municipal/, /decreto/],
      requiresDirectEvidence: true,
    };
  }

  if (topic === "lai") {
    return {
      positive: [
        /lei de acesso a informacao|lei de acesso à informação/,
        /\blai\b/,
        /acesso a informacao|acesso à informação/,
        /transparencia|transparência/,
        /lei\s*(?:n[ºo.]*)?\s*12\.?527/,
      ],
      negative: [
        /plano diretor/,
        /codigo tributario|código tributário/,
        /ata de posse/,
        /diplomacao|diplomação/,
        /magisterio|magistério/,
        /zoneamento|uso do solo/,
      ],
      preferredProviders: ["official_sources", "institutional"],
      preferredTypes: [/lei federal/, /fonte oficial/, /lei de acesso/, /transparencia|transparência/],
      requiresDirectEvidence: true,
    };
  }

  if (topic === "lrf_personnel_expense") {
    return {
      positive: [
        /lei de responsabilidade fiscal/,
        /\blrf\b/,
        /despesa com pessoal/,
        /limite prudencial|limite legal/,
        /lei complementar\s*(?:n[ºo.]*)?\s*101/,
        /relatorio de gestao fiscal|relatório de gestão fiscal/,
      ],
      negative: [
        /plano diretor/,
        /ata de posse/,
        /diplomacao|diplomação/,
        /codigo tributario|código tributário/,
        /zoneamento|uso do solo/,
      ],
      preferredProviders: ["official_sources", "institutional", "official_gazette"],
      preferredTypes: [/lei complementar/, /fonte oficial/, /responsabilidade fiscal/, /relatorio de gestao fiscal|relatório de gestão fiscal/],
      requiresDirectEvidence: true,
    };
  }

  if (topic === "magisterio_career") {
    return {
      positive: [
        /magisterio|magistério/,
        /professor|professores/,
        /docente|docentes/,
        /educacao|educação/,
        /plano de cargos/,
        /carreira do magisterio|carreira do magistério/,
      ],
      negative: [
        /plano diretor/,
        /codigo tributario|código tributário/,
        /lei organica|lei orgânica/,
        /ata de posse/,
        /zoneamento|uso do solo/,
        /iptu|iss|itbi/,
      ],
      preferredProviders: ["institutional", "official_gazette"],
      preferredTypes: [/magisterio|magistério/, /professor/, /plano de cargos/, /carreira/],
      requiresDirectEvidence: true,
    };
  }

  if (topic === "career_progression") {
    return {
      positive: [
        /progressao horizontal|progressão horizontal/,
        /progressao funcional|progressão funcional/,
        /plano de cargos/,
        /carreira|carreiras/,
        /vencimento|vencimentos/,
        /\bpccs\b/,
        /servidor|servidores/,
        /avaliacao de desempenho|avaliação de desempenho/,
      ],
      negative: [
        /plano diretor/,
        /codigo tributario|código tributário/,
        /lei organica|lei orgânica/,
        /ata de posse/,
        /criacao do municipio|criação do município|emancipacao|emancipação/,
        /zoneamento|uso do solo/,
      ],
      preferredProviders: ["institutional", "official_gazette"],
      preferredTypes: [/plano de cargos/, /\bpccs\b/, /carreira/, /estatuto/],
      requiresDirectEvidence: true,
    };
  }

  return {
    positive: [],
    negative: [],
    preferredProviders: ["institutional", "official_gazette", "official_sources"],
    preferredTypes: [],
    requiresDirectEvidence: false,
  };
}

function getTopicSignals(question: string, provider: GovernanceKnowledgeProvider, title: string, type: string, body: string) {
  const analysis = analyzeGovernanceQuery(question);
  const profile = getTopicProfile(analysis.topic);
  const shortText = `${title} ${type} ${body}`.slice(0, 120000);
  const titleAndType = `${title} ${type}`;

  const positiveMatches = profile.positive.filter((pattern) => pattern.test(shortText)).length;
  const negativeMatches = profile.negative.filter((pattern) => pattern.test(shortText)).length;
  const preferredTypeMatches = profile.preferredTypes.filter((pattern) => pattern.test(titleAndType)).length;
  const preferredProvider = profile.preferredProviders.includes(provider);

  let boost = 0;
  const evidence: string[] = [];

  if (positiveMatches > 0) {
    boost += positiveMatches * 34;
    evidence.push(`aderência temática: ${positiveMatches}`);
  }

  if (preferredTypeMatches > 0) {
    boost += preferredTypeMatches * 22;
    evidence.push(`tipo preferencial: ${preferredTypeMatches}`);
  }

  if (preferredProvider) {
    boost += 12;
    evidence.push("fonte preferencial para o tema");
  }

  if ((analysis.topic === "current_mayor" || analysis.topic === "current_vice_mayor") && hasCurrentMandateEvidence(shortText)) {
    boost += 70;
    evidence.push("mandato atual/posse");
  }

  for (const term of analysis.priorityTerms) {
    const normalizedTerm = normalizeGovernanceText(term);
    if (normalizedTerm && shortText.includes(normalizedTerm)) {
      boost += 14;
      evidence.push(`termo prioritário: ${term}`);
    }
  }

  let penalty = 0;

  if (negativeMatches > 0) {
    penalty += negativeMatches * 45;
    evidence.push(`sinal incompatível: -${negativeMatches * 45}`);
  }

  if (profile.requiresDirectEvidence && positiveMatches === 0 && preferredTypeMatches === 0) {
    penalty += 85;
    evidence.push(`sem evidência direta para ${analysis.topic}: -85`);
  }

  if (!preferredProvider && profile.requiresDirectEvidence && positiveMatches <= 1) {
    penalty += 30;
    evidence.push("fonte fraca para o tema: -30");
  }

  if ((analysis.topic === "current_mayor" || analysis.topic === "current_vice_mayor") && /2003|2004|2005|ex-prefeito/.test(shortText) && !hasCurrentMandateEvidence(shortText)) {
    penalty += 130;
    evidence.push("documento antigo para cargo atual: -130");
  }

  return {
    topic: analysis.topic,
    boost,
    penalty,
    positiveMatches,
    negativeMatches,
    preferredTypeMatches,
    preferredProvider,
    evidence,
  };
}

function getIncompatibilityPenalty(question: string, title: string, type: string, body: string) {
  const analysis = analyzeGovernanceQuery(question);
  const q = normalizeGovernanceText(question);
  const haystack = `${title} ${type} ${body}`.slice(0, 20000);

  if (analysis.topic === "lai") {
    if (/plano diretor|uso do solo|zoneamento|codigo tributario|código tributário|ata de posse|diplomacao|diplomação/.test(haystack) && !/lai|lei de acesso|acesso a informacao|acesso à informação|transparencia|transparência|12\.?527/.test(haystack)) {
      return 140;
    }
  }

  if (analysis.topic === "lrf_personnel_expense") {
    if (/plano diretor|uso do solo|zoneamento|ata de posse|diplomacao|diplomação/.test(haystack) && !/lrf|responsabilidade fiscal|despesa com pessoal|lei complementar 101|101\/2000|relatorio de gestao fiscal|relatório de gestão fiscal/.test(haystack)) {
      return 140;
    }
  }

  if (analysis.topic === "magisterio_career") {
    if (/plano diretor|uso do solo|zoneamento|codigo tributario|código tributário|lei organica|lei orgânica|ata de posse/.test(haystack) && !/magisterio|magistério|professor|docente|educacao|educação/.test(haystack)) {
      return 120;
    }
  }

  if (/progressao|progressão|carreira|pccs|servidor|vencimento|classe|nivel|nível/.test(q)) {
    if (/cria( o|cao|ção)? municipio|criacao do municipio|criação do município|emancipacao|emancipação/.test(haystack)) {
      return 100;
    }
    if (/plano diretor|uso do solo|zoneamento/.test(haystack) && !/progressao|progressão|carreira|servidor|pccs/.test(haystack)) {
      return 90;
    }
  }

  if (/estrutura administrativa|secretaria|departamento|organograma/.test(q)) {
    if (/cria( o|cao|ção)? municipio|criacao do municipio|criação do município|emancipacao|emancipação|plano diretor|uso do solo|zoneamento|codigo tributario|código tributário|iptu|iss|itbi/.test(haystack)) {
      return 110;
    }
  }

  return 0;
}

export function scoreGovernanceKnowledgeItem(params: ScoreParams): GovernanceKnowledgeScoreResult {
  const tokens = uniqueTokens(getGovernanceSearchTokens(params.question));
  const phrases = getExactQuestionPhrases(params.question);

  const title = normalizeGovernanceText(params.title);
  const body = normalizeGovernanceText(params.body);
  const type = normalizeGovernanceText(params.type ?? "");
  const combined = `${title} ${type} ${body}`;
  const analysis = analyzeGovernanceQuery(params.question);

  const titleMatches = countMatches(title, tokens);
  const typeMatches = countMatches(type, tokens);
  const bodyMatches = countMatches(body, tokens);
  const phraseMatches = phrases.filter((phrase) => combined.includes(phrase)).length;
  const totalMatches = titleMatches + typeMatches + bodyMatches;
  const matchRatio = tokens.length > 0 ? totalMatches / tokens.length : 0;

  let score = 0;
  const evidence: string[] = [`tópico: ${analysis.topic}`];

  if (
    params.provider === "official_sources" &&
    isCompensationOrPayrollQuestion(params.question) &&
    isTransparencyOfficialSourceText(`${title} ${type} ${body} ${normalizeGovernanceText(params.url ?? "")}`)
  ) {
    score += 220;
    evidence.push("fonte oficial de transparência para conferência de remuneração/subsídio");
  }

  if (
    params.provider === "official_sources" &&
    /\b(licitacao|licitações|licitacoes|dispensa|inexigibilidade|pregao|pregão|contrato|contratos)\b/i.test(params.question) &&
    /\b(onde|consultar|encontrar|acessar|buscar|localizar|portal|transparencia|transparência|site|fonte|fontes)\b/i.test(params.question) &&
    isTransparencyOfficialSourceText(`${title} ${type} ${body} ${normalizeGovernanceText(params.url ?? "")}`)
  ) {
    score += 180;
    evidence.push("fonte oficial de transparência para consulta de licitações/contratos");
  }

  if (params.provider === "official_sources") {
    const transparencyTopicBoost = getTransparencyTopicOfficialSourceBoost(
      normalizeGovernanceText(params.question),
      `${title} ${type} ${body} ${normalizeGovernanceText(params.url ?? "")}`,
    );

    if (transparencyTopicBoost.boost > 0) {
      score += transparencyTopicBoost.boost;
      evidence.push(...transparencyTopicBoost.evidence);
    }
  }

  if (phraseMatches > 0) {
    score += phraseMatches * 50;
    evidence.push(`frase exata: ${phraseMatches}`);
  }

  if (titleMatches > 0) {
    score += titleMatches * 24;
    evidence.push(`título: ${titleMatches}`);
  }

  if (typeMatches > 0) {
    score += typeMatches * 12;
    evidence.push(`tipo: ${typeMatches}`);
  }

  if (bodyMatches > 0) {
    score += Math.min(70, bodyMatches * 5);
    evidence.push(`texto: ${bodyMatches}`);
  }

  if (matchRatio > 0) {
    const ratioBoost = Math.round(clamp(matchRatio, 0, 1.5) * 28);
    score += ratioBoost;
    evidence.push(`cobertura da pergunta: ${ratioBoost}`);
  }

  const topicSignals = getTopicSignals(params.question, params.provider, title, type, body);
  score += topicSignals.boost;
  score -= topicSignals.penalty;
  evidence.push(...topicSignals.evidence);

  const typeWeight = getTypeWeight(type, title, analysis.topic);
  if (typeWeight !== 0) {
    score += typeWeight;
    evidence.push(`peso documental: ${typeWeight}`);
  }

  const authorityWeight = getAuthorityWeight(params.provider, title, type, params.url);
  if (authorityWeight > 0 && (score > 0 || topicSignals.positiveMatches > 0 || phraseMatches > 0)) {
    score += authorityWeight;
    evidence.push(`autoridade: ${authorityWeight}`);
  }

  const providerWeight = getProviderWeight(params.provider, analysis.topic);
  if (score > 0) {
    score += providerWeight;
    evidence.push(`base: ${providerWeight}`);
  }

  if (params.url) {
    score += 6;
    evidence.push("link validado");
  }

  const recency = getRecencyWeight(params.recencyDate, analysis.topic);
  if (recency !== 0) {
    score += recency;
    evidence.push(`recência: ${recency}`);
  }

  const incompatibilityPenalty = getIncompatibilityPenalty(params.question, title, type, body);
  if (incompatibilityPenalty > 0) {
    score -= incompatibilityPenalty;
    evidence.push(`penalidade irrelevância: -${incompatibilityPenalty}`);
  }

  const requiresDirectEvidence = getTopicProfile(analysis.topic).requiresDirectEvidence;
  const hasDirectTopicEvidence = topicSignals.positiveMatches > 0 || topicSignals.preferredTypeMatches > 0 || phraseMatches > 0;

  if (requiresDirectEvidence && !hasDirectTopicEvidence) {
    score = Math.min(score, 20);
    evidence.push("limitado: sem evidência temática direta");
  }

  const finalScore = Math.max(0, Math.round(score));
  const confidence = finalScore <= 0 ? 0 : clamp(finalScore / 220, 0.05, 1);

  return {
    score: finalScore,
    evidence,
    confidence,
    topic: analysis.topic,
    relevance: {
      topic: analysis.topic,
      titleMatches,
      typeMatches,
      bodyMatches,
      phraseMatches,
      positiveTopicSignals: topicSignals.positiveMatches,
      negativeTopicSignals: topicSignals.negativeMatches,
      preferredProvider: topicSignals.preferredProvider,
      preferredTypeMatches: topicSignals.preferredTypeMatches,
      hasDirectTopicEvidence,
      requiresDirectEvidence,
    },
  };
}

export function sortAndFilterKnowledgeItems(items: GovernanceKnowledgeItem[]) {
  const sorted = [...items]
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const aConfidence = typeof itemConfidence(a) === "number" ? itemConfidence(a) : 0;
      const bConfidence = typeof itemConfidence(b) === "number" ? itemConfidence(b) : 0;
      if (bConfidence !== aConfidence) return bConfidence - aConfidence;

      return a.title.localeCompare(b.title, "pt-BR");
    });

  const topScore = sorted[0]?.score ?? 0;

  if (topScore <= 0) {
    return [];
  }

  const minScore = Math.max(70, Math.floor(topScore * 0.68));

  return sorted.filter((item) => {
    if (item.score < minScore) return false;

    const relevance = item.metadata?.relevance;
    if (
      relevance &&
      typeof relevance === "object" &&
      "requiresDirectEvidence" in relevance &&
      "hasDirectTopicEvidence" in relevance &&
      (relevance as { requiresDirectEvidence?: unknown }).requiresDirectEvidence === true &&
      (relevance as { hasDirectTopicEvidence?: unknown }).hasDirectTopicEvidence !== true
    ) {
      return false;
    }

    return true;
  });
}

function itemConfidence(item: GovernanceKnowledgeItem) {
  const value = item.metadata?.confidence;

  return typeof value === "number" ? value : 0;
}
