import type OpenAI from "openai";

import type { GovernanceResponseMode } from "@/types/governance";

export type SuggestedNextQuestion = {
  id: string;
  label: string;
  prompt: string;
};

type GenerateGovernanceFollowUpSuggestionsParams = {
  openai: OpenAI | null;
  model: string;
  userContent: string;
  assistantText: string;
  responseMode: GovernanceResponseMode;
  hasSelectedPdfAttachments: boolean;
  selectedPdfAttachmentNames: string[];
};

function clampText(value: string, maxChars: number) {
  const normalizedValue = String(value ?? "").trim();

  if (normalizedValue.length <= maxChars) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function stripSuggestionMarkdown(value: string) {
  return String(value ?? "")
    .replace(/^[-*•\d.)\s]+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSuggestionText(value: unknown) {
  const text = stripSuggestionMarkdown(String(value ?? ""));

  if (!text) {
    return "";
  }

  return text.length > 140 ? `${text.slice(0, 137).trim()}...` : text;
}

function makeSuggestionId(value: string, index: number) {
  const base = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return base ? `${base}-${index + 1}` : `suggestion-${index + 1}`;
}

function isSuggestionRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSuggestionList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isSuggestionRecord(value)) {
    return [];
  }

  if (Array.isArray(value.suggestions)) {
    return value.suggestions;
  }

  if (Array.isArray(value.questions)) {
    return value.questions;
  }

  return [];
}

export function parseSuggestedNextQuestions(
  rawText: string,
): SuggestedNextQuestion[] {
  const text = String(rawText ?? "").trim();

  if (!text) {
    return [];
  }

  const candidates: unknown[] = [];

  try {
    candidates.push(...getSuggestionList(JSON.parse(text)));
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);

    if (jsonMatch?.[0]) {
      try {
        candidates.push(...getSuggestionList(JSON.parse(jsonMatch[0])));
      } catch {
        // O fallback por linhas será aplicado abaixo.
      }
    }
  }

  if (candidates.length === 0) {
    const fallbackLines = text
      .split("\n")
      .map((line) => normalizeSuggestionText(line))
      .filter(Boolean);

    candidates.push(...fallbackLines);
  }

  const seen = new Set<string>();
  const suggestions: SuggestedNextQuestion[] = [];

  for (const candidate of candidates) {
    const candidateRecord = isSuggestionRecord(candidate) ? candidate : null;

    const rawLabel =
      typeof candidate === "string"
        ? candidate
        : candidateRecord?.label ??
          candidateRecord?.question ??
          candidateRecord?.prompt;

    const rawPrompt =
      typeof candidate === "string"
        ? candidate
        : candidateRecord?.prompt ??
          candidateRecord?.question ??
          candidateRecord?.label;

    const label = normalizeSuggestionText(rawLabel);
    const prompt = normalizeSuggestionText(rawPrompt);

    if (!label || !prompt) {
      continue;
    }

    const key = prompt.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    suggestions.push({
      id: makeSuggestionId(prompt, suggestions.length),
      label,
      prompt,
    });

    if (suggestions.length >= 5) {
      break;
    }
  }

  return suggestions;
}

export async function generateGovernanceFollowUpSuggestions(
  params: GenerateGovernanceFollowUpSuggestionsParams,
): Promise<SuggestedNextQuestion[]> {
  if (!params.openai) {
    return [];
  }

  const assistantContext = clampText(params.assistantText, 7000);
  const userContext = clampText(params.userContent, 1800);

  if (!assistantContext) {
    return [];
  }

  const pdfContext = params.hasSelectedPdfAttachments
    ? [
        "A pergunta envolveu PDFs selecionados.",
        params.selectedPdfAttachmentNames.length > 0
          ? `PDFs informados: ${params.selectedPdfAttachmentNames.join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "A pergunta não usou PDFs selecionados.";

  const suggestionInstructions = [
    "Você gera sugestões inteligentes de próxima pergunta para o chat Publ.IA Governança.",
    "Baseie-se exclusivamente na pergunta do usuário e na resposta da IA.",
    "Crie perguntas realmente contextuais, específicas e úteis para continuidade da conversa.",
    "Não use sugestões genéricas como 'Gerar resumo executivo', 'Pontos de atenção' ou 'Transformar em checklist', salvo se isso for claramente o próximo passo mais específico.",
    "As perguntas devem ser em português do Brasil, curtas e acionáveis.",
    "Retorne somente JSON válido, sem Markdown, sem comentários e sem texto antes ou depois.",
    'Formato obrigatório: {"suggestions":[{"label":"...","prompt":"..."}]}',
    "Gere entre 3 e 5 sugestões.",
  ].join("\n");

  const suggestionInput = [
    {
      role: "user" as const,
      content: [
        `Modo de resposta usado: ${params.responseMode}.`,
        pdfContext,
        "",
        "Pergunta do usuário:",
        userContext,
        "",
        "Resposta da IA:",
        assistantContext,
      ].join("\n"),
    },
  ];

  try {
    const response = await params.openai.responses.create({
      model: params.model,
      instructions: suggestionInstructions,
      input: suggestionInput,
      temperature: 0.2,
      max_output_tokens: 700,
    } as Parameters<typeof params.openai.responses.create>[0]);

    const outputText =
      typeof response === "object" &&
      response !== null &&
      "output_text" in response &&
      typeof response.output_text === "string"
        ? response.output_text
        : "";

    return parseSuggestedNextQuestions(outputText);
  } catch (error) {
    console.error(
      "[governance/chat] Erro ao gerar sugestões de próxima pergunta:",
      error,
    );
    return [];
  }
}

type GenerateGovernanceResponseSuggestionsParams =
  GenerateGovernanceFollowUpSuggestionsParams & {
    suppress?: boolean;
  };

export async function generateGovernanceResponseSuggestions(
  params: GenerateGovernanceResponseSuggestionsParams,
): Promise<SuggestedNextQuestion[]> {
  if (params.suppress) {
    return [];
  }

  return generateGovernanceFollowUpSuggestions(params);
}


type CreateGovernanceResponseSuggestionGeneratorParams = Omit<
  GenerateGovernanceFollowUpSuggestionsParams,
  "assistantText"
>;

type GenerateGovernanceRouteSuggestionsParams = {
  assistantText: string;
  suppress?: boolean;
};

export function createGovernanceResponseSuggestionGenerator(
  params: CreateGovernanceResponseSuggestionGeneratorParams,
) {
  return function generateGovernanceRouteSuggestions({
    assistantText,
    suppress,
  }: GenerateGovernanceRouteSuggestionsParams) {
    return generateGovernanceResponseSuggestions({
      ...params,
      assistantText,
      suppress,
    });
  };
}

