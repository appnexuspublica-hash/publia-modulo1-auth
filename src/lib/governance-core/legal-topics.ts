import { normalizeRecoveryText } from "@/lib/governance/recovery/normalize";
import type { GovernanceV2QueryPlan } from "./types";

export type GovernanceLegalTopic =
  | "constitutional_principles"
  | "municipal_irrf"
  | "procurement_direct_award"
  | null;

export const PROCUREMENT_2026 = {
  statuteTitle: "Lei nº 14.133/2021 — Lei de Licitações e Contratos Administrativos",
  statuteUrl: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm",
  decreeTitle: "Decreto nº 12.807/2025 — atualização dos valores da Lei nº 14.133/2021",
  decreeUrl: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12807.htm",
  effectiveFrom: "2026-01-01",
  engineeringThreshold: "R$ 130.984,20",
  generalThreshold: "R$ 65.492,11",
} as const;

export function resolveGovernanceLegalTopic(question: string): GovernanceLegalTopic {
  const q = normalizeRecoveryText(question);

  if (/principios constitucionais|art\.?\s*37|legalidade|impessoalidade|moralidade|publicidade|eficiencia/.test(q)) {
    return "constitutional_principles";
  }

  if (/\birrf\b|imposto de renda retido|retencao de ir|pode ficar com o ir/.test(q)) {
    return "municipal_irrf";
  }

  if (/lei\s*14\.?133|licitac|sem licitar|sem licitacao|dispensa|inexigibilidade|contratacao direta|fracionamento|dividir a compra|limite de dispensa|quanto pode (?:ser )?contratado|quanto a prefeitura pode comprar/.test(q)) {
    return "procurement_direct_award";
  }

  return null;
}

export function buildGovernanceLegalTopicInstruction(plan: GovernanceV2QueryPlan) {
  if (plan.legalTopic === "procurement_direct_award") {
    const directNumeric = plan.answerShape === "direct_numeric";
    const yesNo = plan.answerShape === "yes_no";

    return [
      "PACOTE JURÍDICO CONSOLIDADO — CONTRATAÇÃO DIRETA POR VALOR",
      `Vigência confirmada: ${PROCUREMENT_2026.effectiveFrom}.`,
      `Obras e serviços de engenharia e serviços de manutenção de veículos: ${PROCUREMENT_2026.engineeringThreshold}.`,
      `Compras e demais serviços: ${PROCUREMENT_2026.generalThreshold}.`,
      `Ato atualizador: ${PROCUREMENT_2026.decreeTitle}.`,
      "Fundamentos centrais: Lei nº 14.133/2021, arts. 75, I e II, e 182.",
      "A vedação ao fracionamento deve ser explicada considerando o valor global previsível da necessidade e o planejamento da contratação.",
      directNumeric
        ? "Comece obrigatoriamente pelos dois valores vigentes, de forma objetiva, antes de qualquer explicação."
        : "",
      yesNo
        ? "Comece obrigatoriamente com Sim, Não ou Depende. Em perguntas sobre dividir ou fracionar, comece com Não e informe os limites vigentes para contextualizar a vedação."
        : "",
      "Não diga que precisa consultar o decreto para descobrir os valores: eles já estão confirmados neste pacote.",
      "Use a pesquisa oficial apenas para complementar ou reconfirmar, nunca para substituir estes dados consolidados já validados.",
    ].filter(Boolean).join("\n");
  }

  if (plan.legalTopic === "municipal_irrf") {
    return [
      "PACOTE JURÍDICO CONSOLIDADO — IRRF MUNICIPAL",
      "Comece com Sim.",
      "Fundamentos obrigatórios: Constituição Federal, art. 158, I, e STF, Tema 1.130 da Repercussão Geral.",
      "Diferencie a titularidade municipal da receita da obrigação operacional de retenção, escrituração e declaração.",
    ].join("\n");
  }

  if (plan.legalTopic === "constitutional_principles") {
    return [
      "PACOTE JURÍDICO CONSOLIDADO — PRINCÍPIOS CONSTITUCIONAIS",
      "Fundamento principal: Constituição Federal de 1988, art. 37, caput.",
      "Explique legalidade, impessoalidade, moralidade, publicidade e eficiência com aplicação prática municipal.",
      "Não acrescente normas federais incidentais sem necessidade direta.",
    ].join("\n");
  }

  return "";
}
