// src/lib/essentialLegalGuardrails.ts
/**
 * Proteções normativas do Publ.IA Essencial.
 *
 * O Essencial reutiliza a base crítica consolidada do projeto, mas normaliza
 * variações comuns das perguntas antes de acionar os guardrails. Isso evita
 * que perguntas equivalentes deixem de receber a mesma proteção normativa.
 */

import { buildGovernanceLegalGuardrails } from "@/lib/governanceLegalGuardrails";

function stripAccents(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalize(value: string) {
  return stripAccents(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function expandEssentialAliases(userText: string) {
  const normalized = normalize(userText);
  const aliases: string[] = [];

  const asksDispensaByValue =
    /\b(sem licitar|sem licitacao|gastar sem licitar|comprar sem licitar|contratar sem licitar|100 mil|50 mil|cem mil|cinquenta mil)\b/.test(
      normalized,
    );

  if (asksDispensaByValue) {
    aliases.push(
      "limite de dispensa de licitação",
      "dispensa de licitação por valor",
      "valor máximo da dispensa",
    );
  }

  const asksMunicipalIrrf =
    /\b(irrf|imposto de renda retido|retencao de imposto de renda)\b/.test(
      normalized,
    ) &&
    /\b(municipio|municipios|municipal|prefeitura|prefeituras)\b/.test(
      normalized,
    );

  if (asksMunicipalIrrf) {
    aliases.push("IRRF municipal", "Tema 1130", "art. 158");
  }

  const asksPersonnelLimits =
    /\b(despesa com pessoal|limite de pessoal|limite prudencial|limite de alerta)\b/.test(
      normalized,
    );

  if (asksPersonnelLimits) {
    aliases.push(
      "LRF",
      "limite prudencial",
      "despesa com pessoal",
    );
  }

  return aliases.length > 0
    ? `${userText}\n\nINTENÇÕES EQUIVALENTES DETECTADAS:\n${aliases.join("\n")}`
    : userText;
}

function buildEssentialSpecificRules(userText: string) {
  const normalized = normalize(userText);
  const rules: string[] = [];

  if (
    /\b(sem licitar|sem licitacao|dispensa|100 mil|50 mil|cem mil|cinquenta mil)\b/.test(
      normalized,
    )
  ) {
    rules.push(
      [
        "REGRA DE RESPOSTA — DISPENSA POR VALOR",
        "- Comece pela resposta objetiva, sem pedir primeiro qual ente ou qual lei se aplica.",
        "- Para 2026, informe expressamente os dois valores vigentes: R$ 130.984,20 e R$ 65.492,11.",
        "- Cite expressamente o Decreto nº 12.807, de 29 de dezembro de 2025, com vigência em 1º de janeiro de 2026.",
        "- Explique que R$ 100.000,00 e R$ 50.000,00 são os valores nominais originais da Lei nº 14.133/2021 e não os tetos atualizados para 2026.",
        "- Não omita um dos dois valores.",
        "- Depois dos valores, resuma processo administrativo, pesquisa de preços, publicidade e vedação ao fracionamento.",
      ].join("\n"),
    );
  }

  if (
    /\b(irrf|imposto de renda retido|retencao de imposto de renda)\b/.test(
      normalized,
    ) &&
    /\b(municipio|municipios|municipal|prefeitura|prefeituras)\b/.test(
      normalized,
    )
  ) {
    rules.push(
      [
        "REGRA DE RESPOSTA — IRRF MUNICIPAL",
        "- Separe claramente: (1) titularidade da receita; e (2) obrigação de retenção.",
        "- Destaque Constituição Federal, art. 158, I; Tema 1.130 do STF; e IN RFB nº 1.234/2012 em sua redação vigente.",
        "- Explique separadamente pagamentos a pessoas jurídicas e pagamentos a pessoas físicas.",
        "- Não afirme que todo pagamento sofre retenção; a incidência, base, alíquota, isenção e dispensa dependem da legislação federal aplicável.",
        "- Não recomende recolhimento à União como regra geral quando o Município é a fonte pagadora e a receita lhe pertence.",
      ].join("\n"),
    );
  }

  if (
    /\b(despesa com pessoal|limite de pessoal|limite prudencial|limite de alerta|lrf)\b/.test(
      normalized,
    )
  ) {
    rules.push(
      [
        "REGRA DE RESPOSTA — LIMITES DE PESSOAL",
        "- Para municípios, destaque primeiro: Município 60% da RCL; Executivo 54%; Legislativo 6%.",
        "- Para o Executivo Municipal, informe: alerta 48,6%; prudencial 51,3%; máximo 54% da RCL.",
        "- Não trate 57% da RCL como limite prudencial do Executivo Municipal; 57% corresponde a 95% do limite global municipal de 60%, não ao limite próprio do Executivo.",
        "- Explique de forma breve as consequências do limite prudencial e do excesso do limite máximo.",
      ].join("\n"),
    );
  }

  if (rules.length === 0) return "";

  return [
    "REGRAS ESPECÍFICAS DO PUBL.IA ESSENCIAL",
    "",
    ...rules,
  ].join("\n\n");
}

export function buildEssentialLegalGuardrails(userText: string): string {
  const expandedText = expandEssentialAliases(userText);
  const sharedRules = buildGovernanceLegalGuardrails(expandedText);
  const essentialRules = buildEssentialSpecificRules(userText);

  return [sharedRules, essentialRules].filter(Boolean).join("\n\n");
}
