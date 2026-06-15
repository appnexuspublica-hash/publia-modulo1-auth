// src/lib/governanceCriticalKnowledge.ts

export type GovernanceCriticalKnowledgeItem = {
  id: string;
  topic:
    | "licitacoes"
    | "tributario"
    | "contabilidade_publica"
    | "controle_interno"
    | "transparencia"
    | "lgpd"
    | "rh";
  subtopic: string;
  risk: "medium" | "high" | "critical";
  title: string;
  priority: "high" | "critical";
  keywords: string[];
  rule: string;
};

export const GOVERNANCE_CRITICAL_KNOWLEDGE: GovernanceCriticalKnowledgeItem[] = [
  {
    id: "dispensa_licitacao_valores_14133",
    topic: "licitacoes",
    subtopic: "dispensa_por_valor",
    risk: "high",
    title: "Dispensa de licitação por valor na Lei nº 14.133/2021",
    priority: "high",
    keywords: [
      "dispensa de licitacao",
      "dispensa de licitação",
      "dispensa por valor",
      "valor da dispensa",
      "valor máximo da dispensa",
      "valor maximo da dispensa",
      "limite da dispensa",
      "limite de dispensa",
      "contratacao direta por valor",
      "contratação direta por valor",
      "art. 75, inciso i",
      "art. 75, inciso ii",
      "artigo 75, inciso i",
      "artigo 75, inciso ii",
    ],
    rule: `
TEMA SENSÍVEL: DISPENSA DE LICITAÇÃO POR VALOR

Regra obrigatória:
- A resposta deve informar os valores objetivos no início, quando o usuário perguntar qual é o limite, valor máximo ou teto da dispensa.
- Base legal: Lei nº 14.133/2021, art. 75, incisos I e II, com atualização monetária anual prevista no art. 182.
- Valores atualizados para 2026 pelo Decreto Federal nº 12.807/2025:
  - Art. 75, inciso I: obras e serviços de engenharia: R$ 130.984,20.
  - Art. 75, inciso II: outros serviços e compras: R$ 65.492,11.
- Cautelas obrigatórias após informar os valores:
  - verificar se o município adotou regulamentação própria compatível;
  - evitar fracionamento de despesa;
  - formalizar processo administrativo;
  - justificar a contratação;
  - realizar pesquisa de preços;
  - observar controles internos e eventual entendimento do Tribunal de Contas competente.

Nunca responder apenas que o usuário deve consultar a legislação vigente quando os valores constarem nesta Base Normativa Oficial.
Nunca omitir os valores quando a pergunta for objetiva sobre limite, teto ou valor máximo.
`,
  },
  {
    id: "emergency_contracts",
    topic: "licitacoes",
    subtopic: "dispensa_emergencial",
    risk: "critical",
    title: "Contratação direta por emergência ou calamidade",
    priority: "critical",
    keywords: [
      "dispensa por emergencia",
      "dispensa emergencial",
      "contratacao emergencial",
      "contrato emergencial",
      "emergencia",
      "calamidade",
      "art. 75",
      "artigo 75",
    ],
    rule: `
TEMA CRÍTICO: CONTRATAÇÃO DIRETA POR EMERGÊNCIA OU CALAMIDADE

Regra obrigatória:
- Lei nº 14.133/2021, art. 75, VIII.
- O contrato deve se limitar ao necessário para atendimento da situação emergencial ou calamitosa.
- Prazo máximo: 1 ano contado da ocorrência da emergência ou calamidade.
- É VEDADA a prorrogação do respectivo contrato.
- É VEDADA a recontratação de empresa já contratada com base nessa hipótese.

Nunca afirmar que contrato emergencial pode ser prorrogado.
Se o usuário perguntar sobre prorrogação, responder expressamente que a lei veda.
`,
  },
  {
    id: "srp_carona",
    topic: "licitacoes",
    subtopic: "carona",
    risk: "critical",
    title: "Adesão a ata de registro de preços / carona",
    priority: "critical",
    keywords: [
      "carona",
      "adesao a ata",
      "adesão a ata",
      "ata de registro de precos",
      "ata de registro de preços",
      "orgao aderente",
      "órgão aderente",
      "nao participante",
      "não participante",
      "art. 86",
      "artigo 86",
    ],
    rule: `
TEMA CRÍTICO: ADESÃO A ATA DE REGISTRO DE PREÇOS / CARONA

Regra obrigatória:
- Lei nº 14.133/2021, art. 86.
- Limite por órgão ou entidade não participante: até 50% dos quantitativos dos itens registrados para o órgão gerenciador e órgãos participantes.
- Limite total das adesões: não pode exceder, na totalidade, ao dobro do quantitativo de cada item registrado na ata.
- Não afirmar que a Lei nº 14.133/2021 deixou de prever limites numéricos.

A resposta deve orientar a verificar também edital, ata, regulamento do órgão gerenciador e norma local.
`,
  },
  {
    id: "sanctions_14133",
    topic: "licitacoes",
    subtopic: "sancoes",
    risk: "critical",
    title: "Sanções na Lei nº 14.133/2021",
    priority: "critical",
    keywords: [
      "sancao",
      "sanção",
      "impedimento de licitar",
      "impedimento de contratar",
      "declaracao de inidoneidade",
      "declaração de inidoneidade",
      "defesa",
      "processo sancionador",
      "art. 157",
      "artigo 157",
    ],
    rule: `
TEMA CRÍTICO: SANÇÕES NA LEI Nº 14.133/2021

Regra obrigatória:
- Antes de aplicar sanção, deve haver processo administrativo com contraditório e ampla defesa.
- Para as sanções dos incisos III e IV do art. 156 da Lei nº 14.133/2021, observar o art. 157.
- Prazo de defesa: 15 dias úteis, contado da intimação.
- Norma municipal não deve reduzir prazo mínimo previsto em lei federal.

Não afirmar prazo de 5 ou 10 dias úteis para defesa quando o caso envolver impedimento de licitar ou declaração de inidoneidade pela Lei nº 14.133/2021.
`,
  },
  {
    id: "irrf_municipal",
    topic: "tributario",
    subtopic: "irrf",
    risk: "critical",
    title: "IRRF municipal",
    priority: "critical",
    keywords: [
      "irrf",
      "imposto de renda retido",
      "retencao de imposto de renda",
      "retenção de imposto de renda",
      "tema 1130",
      "art. 158",
      "artigo 158",
    ],
    rule: `
TEMA CRÍTICO: IRRF MUNICIPAL

Regra obrigatória:
- Constituição Federal, art. 158, I.
- O produto da arrecadação do imposto de renda retido na fonte sobre rendimentos pagos pelo Município, suas autarquias e fundações pertence ao próprio Município.
- Considerar o entendimento do STF no Tema 1130.
- Não orientar recolhimento do IRRF municipal à União como regra geral.

A resposta deve alertar para validação contábil/tributária e adequação aos sistemas oficiais de arrecadação e escrituração.
`,
  },
  {
    id: "lrf_personnel_prudential_limit",
    topic: "contabilidade_publica",
    subtopic: "lrf_pessoal",
    risk: "critical",
    title: "LRF / limite prudencial de despesa com pessoal",
    priority: "critical",
    keywords: [
      "limite prudencial",
      "despesa com pessoal",
      "limite de pessoal",
      "lrf",
      "lei de responsabilidade fiscal",
      "art. 22",
      "artigo 22",
    ],
    rule: `
TEMA CRÍTICO: LRF / DESPESA COM PESSOAL

Regra obrigatória:
- Lei Complementar nº 101/2000.
- O limite prudencial corresponde a 95% do limite máximo de despesa com pessoal.
- Não confundir percentual de atingimento do limite prudencial com percentual de atingimento do limite máximo.
- Quando houver número informado pelo usuário, explicar com cuidado qual é a base de cálculo.

A resposta deve recomendar validação pelo setor contábil/controle interno.
`,
  },
  {
    id: "internship_budget_classification",
    topic: "contabilidade_publica",
    subtopic: "estagio",
    risk: "high",
    title: "Classificação orçamentária de estagiários",
    priority: "high",
    keywords: [
      "estagiario",
      "estagiário",
      "bolsa estagio",
      "bolsa estágio",
      "gnd",
      "grupo de natureza da despesa",
      "elemento 36",
      "3.3.90.36",
    ],
    rule: `
TEMA CRÍTICO: CLASSIFICAÇÃO ORÇAMENTÁRIA DE ESTAGIÁRIOS

Regra obrigatória:
- Bolsa de estágio não deve ser tratada como despesa de pessoal para fins de limite da LRF.
- Em regra, classifica-se como Outras Despesas Correntes, GND 3.
- Referência usual: elemento 3.3.90.36, conforme orientação orçamentária aplicável.
- Não classificar bolsa de estágio como GND 1 - Pessoal e Encargos Sociais.

A resposta deve recomendar validação com a contabilidade e com o manual/orientação vigente da STN/Tesouro.
`,
  },
  {
    id: "health_education_minimums",
    topic: "contabilidade_publica",
    subtopic: "minimos_constitucionais",
    risk: "high",
    title: "Mínimos constitucionais de saúde e educação",
    priority: "high",
    keywords: [
      "minimo constitucional",
      "mínimo constitucional",
      "saude",
      "saúde",
      "educacao",
      "educação",
      "asps",
      "mde",
      "lc 141",
      "ldb",
    ],
    rule: `
TEMA CRÍTICO: MÍNIMOS CONSTITUCIONAIS DE SAÚDE E EDUCAÇÃO

Regra obrigatória:
- Saúde/ASPS: considerar Constituição Federal e Lei Complementar nº 141/2012.
- Educação/MDE: considerar Constituição Federal e arts. 70 e 71 da LDB.
- Não tratar apenas como percentual genérico sem mencionar a base normativa específica.
`,
  },
  {
    id: "electoral_publicity",
    topic: "transparencia",
    subtopic: "publicidade_eleitoral",
    risk: "critical",
    title: "Publicidade institucional em período eleitoral",
    priority: "critical",
    keywords: [
      "publicidade eleitoral",
      "periodo eleitoral",
      "período eleitoral",
      "lei 9.504",
      "art. 73",
      "conduta vedada",
      "publicidade institucional",
    ],
    rule: `
TEMA CRÍTICO: PUBLICIDADE INSTITUCIONAL EM PERÍODO ELEITORAL

Regra obrigatória:
- Considerar a Lei nº 9.504/1997, especialmente art. 73, VI e VII.
- Avaliar risco de conduta vedada.
- Diferenciar publicidade institucional, utilidade pública, obrigação legal de transparência e comunicação emergencial.
`,
  },
  {
    id: "public_notice_publicity_deadline",
    topic: "licitacoes",
    subtopic: "publicidade_edital",
    risk: "high",
    title: "Prazo de publicidade do edital",
    priority: "high",
    keywords: [
      "prazo de publicidade",
      "publicidade do edital",
      "divulgacao do edital",
      "divulgação do edital",
      "pregao eletronico",
      "pregão eletrônico",
      "menor preco",
      "menor preço",
      "art. 55",
      "artigo 55",
    ],
    rule: `
TEMA CRÍTICO: PRAZO DE PUBLICIDADE DO EDITAL NA LEI Nº 14.133/2021

Regra obrigatória:
- Ao tratar de prazo mínimo de divulgação de edital, observar o art. 55 da Lei nº 14.133/2021.
- Para aquisição de bens, o prazo mínimo é de 8 dias úteis quando adotados os critérios de menor preço ou maior desconto.
- Para serviços e obras, verificar o enquadramento específico do objeto antes de afirmar o prazo.
- Não confundir inciso, alínea ou tipo de objeto.
- Quando houver dúvida sobre o objeto, explicar a regra e solicitar/indicar validação do enquadramento.
`,
  },
  {
    id: "accreditation_credenciamento",
    topic: "licitacoes",
    subtopic: "credenciamento",
    risk: "high",
    title: "Credenciamento na Lei nº 14.133/2021",
    priority: "high",
    keywords: [
      "credenciamento",
      "medicos peritos",
      "médicos peritos",
      "junta medica",
      "junta médica",
      "art. 78",
      "artigo 78",
      "art. 79",
      "artigo 79",
    ],
    rule: `
TEMA CRÍTICO: CREDENCIAMENTO NA LEI Nº 14.133/2021

Regra obrigatória:
- A Lei nº 14.133/2021 trata dos procedimentos auxiliares no art. 78.
- O credenciamento possui disciplina específica no art. 79.
- Evitar afirmar que todo credenciamento é inexigibilidade clássica.
- Quando houver contratação de todos os interessados que preencham condições objetivas, orientar chamamento/edital de credenciamento com critérios impessoais, tabela de remuneração e regras de distribuição da demanda.
`,
  },
  {
    id: "reajuste_repactuation",
    topic: "licitacoes",
    subtopic: "reajuste_repactuacao",
    risk: "high",
    title: "Reajuste, repactuação e apostilamento",
    priority: "high",
    keywords: [
      "reajuste",
      "repactuacao",
      "repactuação",
      "apostilamento",
      "convencao coletiva",
      "convenção coletiva",
      "data-base",
      "art. 134",
      "artigo 134",
      "art. 135",
      "artigo 135",
    ],
    rule: `
TEMA CRÍTICO: REAJUSTE, REPACTUAÇÃO E APOSTILAMENTO

Regra obrigatória:
- Distinguir reajuste por índice, repactuação e revisão.
- Reajuste por índice observa periodicidade mínima anual, conforme data-base definida no edital/contrato.
- Repactuação é aplicável, em regra, a serviços contínuos com regime de dedicação exclusiva ou predominância de mão de obra, mediante demonstração analítica da variação de custos.
- Convenção coletiva não autoriza automaticamente antecipar reajuste por índice.
- Apostilamento é forma de formalização/registro quando cabível; não é fundamento autônomo para criar direito financeiro.
`,
  },
  {
    id: "debt_lrf_art31",
    topic: "contabilidade_publica",
    subtopic: "divida_consolidada",
    risk: "high",
    title: "Dívida consolidada na LRF",
    priority: "high",
    keywords: [
      "divida consolidada",
      "dívida consolidada",
      "limite da divida",
      "limite da dívida",
      "art. 31",
      "artigo 31",
    ],
    rule: `
TEMA CRÍTICO: DÍVIDA CONSOLIDADA NA LRF

Regra obrigatória:
- Lei Complementar nº 101/2000, art. 31.
- Se a dívida consolidada ultrapassar o limite ao final de um quadrimestre, deve ser reconduzida até o término dos três quadrimestres subsequentes.
- A redução deve ser de pelo menos 25% no primeiro quadrimestre.
- Não afirmar, como regra geral, exigência de plano aprovado pelo Legislativo se isso não estiver no dispositivo aplicável ou em norma específica.
`,
  },
];
