type OfficialLegalReference = {
  id: string;
  aliases: RegExp[];
  baseLegalTitle: string;
  baseLegalDescription: string;
  consultedTitle: string;
  url: string;
};

const OFFICIAL_LEGAL_REFERENCES: OfficialLegalReference[] = [
  {
    id: "constituicao-federal-1988",
    aliases: [
      /\bconstitui(?:ç|c)[aã]o\s+federal\b/i,
      /\bconstitui(?:ç|c)[aã]o\s+da\s+rep[uú]blica\s+federativa\s+do\s+brasil\b/i,
      /\bcf\/?88\b/i,
      /\bart(?:igo)?\.?\s*158\s*,?\s*i\b/i,
    ],
    baseLegalTitle: "Constituição da República Federativa do Brasil de 1988 — art. 158, I",
    baseLegalDescription:
      "repartição da receita do imposto de renda retido na fonte por Estados, Distrito Federal e Municípios",
    consultedTitle:
      "Constituição da República Federativa do Brasil de 1988 — texto compilado",
    url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicaocompilado.htm",
  },
  {
    id: "codigo-tributario-nacional",
    aliases: [
      /\bc[oó]digo\s+tribut[aá]rio\s+nacional\b/i,
      /\bctn\b/i,
      /\blei\s+n[ºo.]?\s*5\.?172(?:\/1966)?\b/i,
    ],
    baseLegalTitle: "Código Tributário Nacional — Lei nº 5.172/1966",
    baseLegalDescription:
      "normas gerais de direito tributário, incluindo competência, obrigação e crédito tributário",
    consultedTitle:
      "Lei nº 5.172/1966 — Código Tributário Nacional — texto compilado",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm",
  },
  {
    id: "in-rfb-1234-2012",
    aliases: [
      /\binstru(?:ç|c)[aã]o\s+normativa\s+rfb\s+n[ºo.]?\s*1\.?234(?:\/2012)?\b/i,
      /\bin\s+rfb\s+n[ºo.]?\s*1\.?234(?:\/2012)?\b/i,
    ],
    baseLegalTitle: "Instrução Normativa RFB nº 1.234/2012 (e alterações)",
    baseLegalDescription:
      "retenção de tributos nos pagamentos efetuados por órgãos e entidades da Administração Pública",
    consultedTitle:
      "Instrução Normativa RFB nº 1.234/2012 — texto oficial",
    url: "https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=37200",
  },
  {
    id: "tema-stf-1130",
    aliases: [
      /\btema\s+n[ºo.]?\s*1\.?130\b/i,
      /\btema\s+1\.?130\s+da\s+repercuss[aã]o\s+geral\b/i,
      /\bre\s+1\.?293\.?453\b/i,
    ],
    baseLegalTitle: "Tema 1.130 da Repercussão Geral do STF",
    baseLegalDescription:
      "titularidade da receita do IRRF retido na fonte por Estados, Distrito Federal e Municípios sobre rendimentos que pagam",
    consultedTitle:
      "Supremo Tribunal Federal — Tema 1.130 da Repercussão Geral",
    url: "https://portal.stf.jus.br/jurisprudenciaRepercussao/tema.asp?num=1130",
  },
  {
    id: "lei-complementar-101-2000",
    aliases: [
      /\blei\s+complementar\s+n[ºo.]?\s*101(?:\/2000)?\b/i,
      /\blei\s+de\s+responsabilidade\s+fiscal\b/i,
      /\blrf\b/i,
    ],
    baseLegalTitle: "Lei Complementar nº 101/2000 — Lei de Responsabilidade Fiscal",
    baseLegalDescription:
      "normas de finanças públicas voltadas à responsabilidade na gestão fiscal",
    consultedTitle:
      "Lei Complementar nº 101/2000 — texto oficial",
    url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm",
  },
  {
    id: "lei-14133-2021",
    aliases: [
      /\blei\s+n[ºo.]?\s*14\.?133(?:\/2021)?\b/i,
      /\bnova\s+lei\s+de\s+licita(?:ç|c)[oõ]es\b/i,
    ],
    baseLegalTitle: "Lei nº 14.133/2021 — Lei de Licitações e Contratos Administrativos",
    baseLegalDescription:
      "normas gerais de licitação e contratação para as Administrações Públicas",
    consultedTitle: "Lei nº 14.133/2021 — texto oficial",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm",
  },
  {
    id: "lei-4320-1964",
    aliases: [/\blei\s+n[ºo.]?\s*4\.?320(?:\/1964)?\b/i],
    baseLegalTitle: "Lei nº 4.320/1964",
    baseLegalDescription:
      "normas gerais de direito financeiro para elaboração e controle dos orçamentos e balanços públicos",
    consultedTitle: "Lei nº 4.320/1964 — texto oficial",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l4320.htm",
  },
  {
    id: "lei-9430-1996",
    aliases: [/\blei\s+n[ºo.]?\s*9\.?430(?:\/1996)?\b/i],
    baseLegalTitle: "Lei nº 9.430/1996",
    baseLegalDescription:
      "legislação tributária federal e regras relacionadas à administração de tributos",
    consultedTitle: "Lei nº 9.430/1996 — texto oficial",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l9430.htm",
  },
];

const LEGAL_SECTION_HEADING =
  /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*(?:Base\s+legal|Fontes\s+consultadas|Fontes)\s*(?:\*\*|__)?\s*:/i;

function stripExistingLegalFooter(markdown: string) {
  const match = LEGAL_SECTION_HEADING.exec(markdown);

  if (!match || match.index === undefined) {
    return markdown.trim();
  }

  return markdown.slice(0, match.index).trim();
}

function isMunicipalIrrfContext(markdown: string) {
  return (
    /\birrf\b/i.test(markdown) &&
    /\bmunic[ií]pio|\bmunicipal|\bestados?\b|\bdistrito\s+federal\b/i.test(
      markdown,
    )
  );
}

function detectReferences(markdown: string) {
  const detected = new Map<string, OfficialLegalReference>();

  for (const reference of OFFICIAL_LEGAL_REFERENCES) {
    if (reference.aliases.some((alias) => alias.test(markdown))) {
      detected.set(reference.id, reference);
    }
  }

  // O conjunto normativo do IRRF municipal é tratado como uma unidade.
  // Isso evita que o modelo omita uma das referências centrais do tema.
  if (isMunicipalIrrfContext(markdown)) {
    for (const id of [
      "constituicao-federal-1988",
      "codigo-tributario-nacional",
      "in-rfb-1234-2012",
      "tema-stf-1130",
    ]) {
      const reference = OFFICIAL_LEGAL_REFERENCES.find(
        (item) => item.id === id,
      );

      if (reference) {
        detected.set(reference.id, reference);
      }
    }
  }

  return Array.from(detected.values());
}

function domainLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function buildLegalFooter(references: OfficialLegalReference[]) {
  if (!references.length) {
    return "";
  }

  const baseLegal = references
    .map(
      (reference) =>
        `- [${reference.baseLegalTitle}](${reference.url}) — ${reference.baseLegalDescription}.`,
    )
    .join("\n");

  const consulted = references
    .map(
      (reference) =>
        `- [${reference.consultedTitle}](${reference.url}).`,
    )
    .join("\n");

  const domains = references
    .map(
      (reference) =>
        `- [${domainLabel(reference.url)}](${reference.url})`,
    )
    .join("; ");

  return [
    "Base legal:",
    "",
    baseLegal,
    "",
    "Fontes consultadas:",
    "",
    consulted,
    "",
    `Fontes: ${domains}.`,
  ].join("\n");
}

/**
 * Finaliza exclusivamente o rodapé jurídico do Publ.IA Estratégico.
 *
 * Regras:
 * - o modelo identifica/cita a norma, mas não escolhe a URL final;
 * - referências conhecidas recebem sempre o documento oficial direto;
 * - páginas institucionais genéricas são descartadas com o rodapé antigo;
 * - Base legal, Fontes consultadas e Fontes são reconstruídas uma única vez;
 * - respostas sem referência jurídica conhecida permanecem inalteradas.
 */
export function finalizeStrategicLegalReferences(markdown: string) {
  const normalizedMarkdown = markdown.trim();
  const references = detectReferences(normalizedMarkdown);

  if (!references.length) {
    return normalizedMarkdown;
  }

  const body = stripExistingLegalFooter(normalizedMarkdown);
  const footer = buildLegalFooter(references);

  return `${body}\n\n---\n\n${footer}`.trim();
}
