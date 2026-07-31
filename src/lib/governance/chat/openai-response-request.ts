// src/lib/governance/chat/openai-response-request.ts

type GovernanceOfficialWebConfig = {
  allowedDomains: string[];
};

type BuildGovernanceOpenAIResponseRequestParams = {
  model: string;
  instructions: string;
  input: unknown;
  forceWebFirst: boolean;
  officialWeb: GovernanceOfficialWebConfig | null | undefined;
  hasGovernanceEvidenceSources: boolean;
  streaming: boolean;
  maxOutputTokens?: number;
};

export function buildGovernanceOpenAIResponseRequest({
  model,
  instructions,
  input,
  forceWebFirst,
  officialWeb,
  hasGovernanceEvidenceSources,
  streaming,
  maxOutputTokens,
}: BuildGovernanceOpenAIResponseRequestParams) {
  return {
    model,
    instructions,
    input,
    ...(forceWebFirst && officialWeb && !hasGovernanceEvidenceSources
      ? {
          tools: [
            {
              type: "web_search",
              filters: {
                allowed_domains: officialWeb.allowedDomains,
              },
              external_web_access: true,
              search_context_size: "medium",
            },
          ],
          tool_choice: "required",
          include: ["web_search_call.action.sources"],
        }
      : {}),
    temperature: 0.3,
    ...(typeof maxOutputTokens === "number"
      ? { max_output_tokens: maxOutputTokens }
      : {}),
    ...(streaming ? { stream: true } : {}),
  };
}
