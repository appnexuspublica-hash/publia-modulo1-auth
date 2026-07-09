import type { GovernanceQueryAnalysis } from "./analyzer";

export type GovernanceLegalCatalogItem = {
  id: string;
  title: string;
  url: string;
  type: "legislação federal" | "orientação oficial" | "jurisprudência" | "legislação municipal";
  notes?: string;
};

const PLANALTO = {
  lai: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm",
  lgpd: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm",
  lrf: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm",
  constituicao: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
};

export function getGovernanceLegalCatalogForQuery(analysis: GovernanceQueryAnalysis): GovernanceLegalCatalogItem[] {
  if (analysis.topic === "lai") {
    return [
      {
        id: "lei-12527-2011-lai",
        title: "Lei nº 12.527/2011 (Lei de Acesso à Informação)",
        url: PLANALTO.lai,
        type: "legislação federal",
        notes: "Regula o acesso a informações públicas.",
      },
      {
        id: "lei-13709-2018-lgpd",
        title: "Lei nº 13.709/2018 (LGPD)",
        url: PLANALTO.lgpd,
        type: "legislação federal",
        notes: "Base para tratamento de dados pessoais e sigilo de dados pessoais.",
      },
      {
        id: "constituicao-art-5-xxxiii",
        title: "Constituição Federal, art. 5º, XXXIII",
        url: PLANALTO.constituicao,
        type: "legislação federal",
        notes: "Direito de receber dos órgãos públicos informações de interesse particular, coletivo ou geral.",
      },
    ];
  }

  if (analysis.topic === "lrf_personnel_expense") {
    return [
      {
        id: "lc-101-2000-lrf-arts-18-23",
        title: "Lei Complementar nº 101/2000 (LRF), arts. 18 a 23",
        url: PLANALTO.lrf,
        type: "legislação federal",
        notes: "Conceito de despesa total com pessoal, limites, limite prudencial, restrições e sanções.",
      },
      {
        id: "constituicao-art-169",
        title: "Constituição Federal, art. 169",
        url: PLANALTO.constituicao,
        type: "legislação federal",
        notes: "Despesa com pessoal ativo e inativo da União, Estados, Distrito Federal e Municípios.",
      },
    ];
  }

  return [];
}

export function buildLegalCatalogContext(items: GovernanceLegalCatalogItem[]) {
  if (items.length === 0) return "";

  return [
    "CATÁLOGO JURÍDICO OFICIAL APLICÁVEL:",
    ...items.map((item) => {
      const notes = item.notes ? ` — ${item.notes}` : "";
      return `- ${item.title} (${item.type}): ${item.url}${notes}`;
    }),
    "",
    "REGRA: use estes fundamentos apenas quando forem pertinentes à pergunta. Não invente artigos além dos indicados.",
  ].join("\n");
}

export function getCanonicalLegalSourcesFromText(question: string, answer: string): GovernanceLegalCatalogItem[] {
  const text = `${question} ${answer}`.toLowerCase();
  const sources: GovernanceLegalCatalogItem[] = [];

  if (
    /\blai\b/.test(text) ||
    /lei de acesso à informação/.test(text) ||
    /lei de acesso a informação/.test(text) ||
    /12\.?527\/2011/.test(text)
  ) {
    sources.push({
      id: "lei-12527-2011-lai",
      title: "Lei nº 12.527/2011 (Lei de Acesso à Informação)",
      url: PLANALTO.lai,
      type: "legislação federal",
    });
  }

  if (
    /\blgpd\b/.test(text) ||
    /lei geral de proteção de dados/.test(text) ||
    /13\.?709\/2018/.test(text) ||
    /dados pessoais/.test(text)
  ) {
    sources.push({
      id: "lei-13709-2018-lgpd",
      title: "Lei nº 13.709/2018 (LGPD)",
      url: PLANALTO.lgpd,
      type: "legislação federal",
    });
  }

  if (
    /\blrf\b/.test(text) ||
    /lei de responsabilidade fiscal/.test(text) ||
    /lei complementar n[º°]?\s*101\/2000/.test(text) ||
    /lc\s*n?[º°]?\s*101\/2000/.test(text) ||
    /despesa com pessoal/.test(text) ||
    /limite prudencial/.test(text)
  ) {
    sources.push({
      id: "lc-101-2000-lrf-arts-18-23",
      title: "Lei Complementar nº 101/2000 (LRF), arts. 18 a 23",
      url: PLANALTO.lrf,
      type: "legislação federal",
    });
  }

  if (
    /constituição federal/.test(text) ||
    /constituição da república/.test(text) ||
    /art\.?\s*37/.test(text) ||
    /art\.?\s*169/.test(text) ||
    /art\.?\s*5[º°]?\s*,?\s*(?:xxxiii|33)/.test(text)
  ) {
    sources.push({
      id: "constituicao-federal",
      title: "Constituição Federal",
      url: PLANALTO.constituicao,
      type: "legislação federal",
    });
  }

  return sources;
}
