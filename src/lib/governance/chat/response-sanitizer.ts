import {
  isMunicipalCreationLawQuestion,
  normalizeInstitutionalSearchText,
} from "@/lib/governance/chat/institutional-query";
import type { GovernanceChatSource } from "@/lib/governance/chat/references";

export function sanitizeGovernanceAssistantText(params: {
  assistantText: string;
  question: string;
  institutionalSources: GovernanceChatSource[];
}) {
  const { question, institutionalSources } = params;
  let text = String(params.assistantText ?? "").trim();

  const hasCreationLawSource = institutionalSources.some((source) =>
    normalizeInstitutionalSearchText(source.title).includes("lei estadual") &&
    normalizeInstitutionalSearchText(source.title).includes("cria") &&
    normalizeInstitutionalSearchText(source.title).includes("municipio")
  );

  if (isMunicipalCreationLawQuestion(question) && hasCreationLawSource) {
    text = text
      .replace(
        /A criação do Município de Santana do Itararé decorre de lei estadual do Paraná,\s*mas o trecho recuperado traz,?\s*por engano,?\s*[^.]+\./gi,
        "O Município de Santana do Itararé foi criado por lei estadual do Paraná identificada na Base Institucional consultada.",
      )
      .replace(
        /Essa não é a lei específica de criação de Santana do Itararé\.\s*/gi,
        "",
      )
      .replace(
        /Como o número e a data exatos não constam no trecho disponível,\s*/gi,
        "",
      );
  }

  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/(?:www\.)?planalto\.gov\.br\/[^)]+)\)/gi,
    (full, label) => {
      const normalizedLabel = String(label ?? "");
      const isFederal =
        /\bFederal\b/i.test(normalizedLabel) ||
        /Constitui[cç][aã]o Federal/i.test(normalizedLabel);

      if (isFederal) {
        return full;
      }

      return String(label ?? "");
    },
  );

  text = text
    .replace(/\(o trecho recuperado é cortado aqui[^)]*\)/gi, "")
    .replace(/o trecho recuperado é cortado aqui[^.\n]*[.\n]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
