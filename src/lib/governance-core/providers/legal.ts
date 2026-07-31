import type { GovernanceV2Evidence, GovernanceV2QueryPlan } from "../types";
import { PROCUREMENT_2026 } from "../legal-topics";

function item(params: {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  score?: number;
  metadata?: Record<string, unknown>;
}): GovernanceV2Evidence {
  return {
    evidenceId: `legal:${params.id}`,
    provider: "legal",
    title: params.title,
    excerpt: params.excerpt,
    url: params.url,
    documentId: null,
    chunkId: null,
    score: params.score ?? 95,
    exact: true,
    factual: true,
    metadata: {
      kind: "legal_reference",
      ...(params.metadata ?? {}),
    },
  };
}

export async function recoverLegalV2(
  question: string,
  plan?: GovernanceV2QueryPlan,
): Promise<GovernanceV2Evidence[]> {
  const q = question.toLowerCase();
  const items: GovernanceV2Evidence[] = [];
  const topic = plan?.legalTopic ?? null;

  if (
    topic === "constitutional_principles" ||
    /constitui|art\.?\s*37|princ[ií]pios constitucionais|legalidade|impessoalidade|moralidade|publicidade|efici[eê]ncia/.test(q)
  ) {
    items.push(item({
      id: "constituicao-art-37",
      title: "Constituição Federal de 1988 — art. 37, caput",
      excerpt: "A administração pública direta e indireta obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência.",
      url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
      score: 100,
      metadata: { legal_topic: "constitutional_principles" },
    }));
  }

  if (
    topic === "procurement_direct_award" ||
    /lei\s*14\.?133|licitac|sem licitar|sem licita[cç][aã]o|dispensa|inexigibilidade|contrata[cç][aã]o direta|fracionamento|dividir a compra|quanto pode (?:ser )?contratado|quanto a prefeitura pode comprar/.test(q)
  ) {
    items.push(item({
      id: "lei-14133",
      title: PROCUREMENT_2026.statuteTitle,
      excerpt: [
        "A Lei nº 14.133/2021 disciplina a contratação direta e a dispensa por valor.",
        "Os arts. 75, I e II, tratam dos limites por categoria; o art. 182 determina a atualização anual.",
        "O fracionamento artificial da necessidade para enquadrar parcelas nos limites de dispensa é incompatível com o planejamento e com a apuração do valor global previsível da contratação.",
      ].join(" "),
      url: PROCUREMENT_2026.statuteUrl,
      score: 100,
      metadata: {
        legal_topic: "procurement_direct_award",
        articles: [75, 182],
      },
    }));

    items.push(item({
      id: "decreto-12807-2025",
      title: PROCUREMENT_2026.decreeTitle,
      excerpt: [
        `Valores vigentes a partir de 1º/01/2026: ${PROCUREMENT_2026.engineeringThreshold} para obras e serviços de engenharia e serviços de manutenção de veículos;`,
        `${PROCUREMENT_2026.generalThreshold} para compras e demais serviços.`,
        "Esses valores devem ser considerados tanto em perguntas sobre limite de dispensa quanto em perguntas sobre fracionamento da despesa.",
      ].join(" "),
      url: PROCUREMENT_2026.decreeUrl,
      score: 99,
      metadata: {
        legal_topic: "procurement_direct_award",
        effective_from: PROCUREMENT_2026.effectiveFrom,
        engineering_threshold: PROCUREMENT_2026.engineeringThreshold,
        general_threshold: PROCUREMENT_2026.generalThreshold,
      },
    }));
  }

  if (/\blai\b|lei de acesso|acesso [aà] informa[cç][aã]o/.test(q)) {
    items.push(item({
      id: "lai",
      title: "Lei nº 12.527/2011 — Lei de Acesso à Informação",
      excerpt: "Regulamenta o direito de acesso a informações públicas.",
      url: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm",
    }));
  }

  if (/\blgpd\b|prote[cç][aã]o de dados|dados pessoais/.test(q)) {
    items.push(item({
      id: "lgpd",
      title: "Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais",
      excerpt: "Dispõe sobre o tratamento de dados pessoais.",
      url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm",
    }));
  }

  if (/responsabilidade fiscal|\blrf\b|lei complementar\s*101/.test(q)) {
    items.push(item({
      id: "lrf",
      title: "Lei Complementar nº 101/2000 — Lei de Responsabilidade Fiscal",
      excerpt: "Estabelece normas de finanças públicas voltadas à responsabilidade na gestão fiscal.",
      url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm",
    }));
  }

  if (
    topic === "municipal_irrf" ||
    /\birrf\b|imposto de renda retido|reten[cç][aã]o de ir|pode ficar com o ir/.test(q)
  ) {
    items.push(item({
      id: "constituicao-art-158",
      title: "Constituição Federal de 1988 — art. 158, I",
      excerpt: "Pertence aos Municípios o produto da arrecadação do imposto de renda incidente na fonte sobre rendimentos pagos por eles, suas autarquias e fundações.",
      url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
      score: 100,
      metadata: { legal_topic: "municipal_irrf" },
    }));
    items.push(item({
      id: "stf-tema-1130",
      title: "STF — Tema 1.130 da Repercussão Geral",
      excerpt: "Reconhece a titularidade municipal do IRRF sobre pagamentos realizados pelo Município, suas autarquias e fundações, nos termos da tese fixada.",
      url: "https://portal.stf.jus.br/jurisprudenciaRepercussao/verAndamentoProcesso.asp?incidente=5923394&numeroProcesso=1293453&classeProcesso=RE&numeroTema=1130",
      score: 99,
      metadata: { legal_topic: "municipal_irrf" },
    }));
  }

  return items;
}
