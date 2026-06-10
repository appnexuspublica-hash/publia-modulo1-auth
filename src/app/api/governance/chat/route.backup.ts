// src/app/api/governance/chat/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";
import { buildProductScopedPrompt } from "@/lib/publiaPrompt";
import { chunkText, pickRelevantChunks } from "@/lib/pdf/chunking";
import type {
  GovernanceMessage,
  GovernanceResponseMode,
} from "@/types/governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openaiApiKey = process.env.OPENAI_API_KEY;

const OPENAI_MODEL_GOVERNANCE =
  process.env.OPENAI_MODEL_GOVERNANCE ||
  process.env.OPENAI_MODEL_NO_PDF ||
  "gpt-5.1";

const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

const RAG_TOP_K = Math.max(2, Math.min(10, Number(process.env.RAG_TOP_K ?? 4)));

const MAX_USER_MESSAGE_LENGTH = 12000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_GOVERNANCE_PDF_CONTEXT_CHARS = 9000;
const MAX_SELECTED_PDFS_IN_GOVERNANCE_CHAT = 5;

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};


let openai: OpenAI | null = null;

if (!openaiApiKey) {
  console.error("[/api/governance/chat] OPENAI_API_KEY não está definida.");
} else {
  openai = new OpenAI({ apiKey: openaiApiKey });
}

type GovernanceChatRequestBody = {
  conversationId?: string;
  content?: string;
  responseMode?: GovernanceResponseMode;
  selectedPdfAttachmentNames?: string[];
  selectedPdfFileIds?: string[];
};

type GovernanceConversationForChat = {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  category: string | null;
  response_mode: GovernanceResponseMode;
  visibility: "private" | "organization";
  status: "active" | "archived" | "deleted";
  deleted_at: string | null;
};

type OpenAIInputMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const allowedResponseModes: GovernanceResponseMode[] = [
  "objective",
  "summary",
  "checklist",
  "technical_opinion",
  "risk_analysis",
  "attention_points",
  "action_plan",
  "draft",
  "comparison",
  "manager_guidance",
];

function isValidGovernanceResponseMode(
  value: unknown,
): value is GovernanceResponseMode {
  return (
    typeof value === "string" &&
    allowedResponseModes.includes(value as GovernanceResponseMode)
  );
}

function normalizeResponseMode(
  value: unknown,
  fallback: GovernanceResponseMode,
): GovernanceResponseMode {
  return isValidGovernanceResponseMode(value) ? value : fallback;
}

function createWritableSupabaseRouteClient() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

function mapGovernanceModeToPromptMode(
  mode: GovernanceResponseMode,
):
  | "objective"
  | "summary"
  | "step_by_step"
  | "checklist"
  | "document_draft"
  | "manager_guidance" {
  switch (mode) {
    case "summary":
      return "summary";

    case "checklist":
    case "risk_analysis":
    case "attention_points":
    case "action_plan":
    case "comparison":
      return "checklist";

    case "technical_opinion":
    case "draft":
      return "document_draft";

    case "manager_guidance":
      return "manager_guidance";

    case "objective":
    default:
      return "objective";
  }
}

function buildGovernanceModeInstruction(mode: GovernanceResponseMode): string {
  switch (mode) {
    case "summary":
      return [
        "MODO DE RESPOSTA ATIVO: RESUMO.",
        "OBEDEÇA AO FORMATO: entregue uma síntese curta, sem parecer, sem checklist longo e sem plano de ação.",
        "Estrutura obrigatória:",
        "1. Comece com 1 parágrafo de visão geral.",
        "2. Depois apresente no máximo 5 pontos essenciais.",
        "3. Finalize com uma conclusão prática em 1 parágrafo.",
        "Limite a resposta a uma versão enxuta, focada no essencial.",
      ].join("\n");

    case "checklist":
      return [
        "MODO DE RESPOSTA ATIVO: CHECKLIST.",
        "OBEDEÇA AO FORMATO: a resposta deve ser predominantemente uma lista verificável.",
        "Estrutura obrigatória:",
        "Título: CHECKLIST PRÁTICO",
        "Use itens iniciados por '☐'.",
        "Cada item deve ser acionável e verificável.",
        "Evite parágrafos longos. Não escreva parecer, minuta ou análise de risco.",
      ].join("\n");

    case "technical_opinion":
      return [
        "MODO DE RESPOSTA ATIVO: PARECER TÉCNICO.",
        "OBEDEÇA AO FORMATO: a resposta deve iniciar obrigatoriamente com o título PARECER TÉCNICO.",
        "Escreva como documento técnico institucional, não como conversa, resumo, checklist, minuta ou orientação ao gestor.",
        "Use obrigatoriamente estes blocos, nesta ordem e com títulos em caixa alta:",
        "PARECER TÉCNICO",
        "",
        "1. ASSUNTO",
        "Indique em uma frase o tema analisado.",
        "",
        "2. RELATÓRIO",
        "Contextualize brevemente a situação apresentada pelo usuário.",
        "",
        "3. FUNDAMENTAÇÃO TÉCNICA",
        "Aponte os fundamentos administrativos, técnicos e normativos aplicáveis, sem inventar norma local.",
        "",
        "4. ANÁLISE",
        "Examine o caso de forma objetiva, relacionando fatos, cautelas, riscos e condições de validade.",
        "",
        "5. CONCLUSÃO",
        "Apresente conclusão clara sobre o entendimento técnico.",
        "",
        "6. RECOMENDAÇÃO TÉCNICA",
        "Indique as providências recomendadas ao órgão.",
        "",
        "É proibido começar com introdução conversacional do tipo 'Na prática' ou 'O ponto central é'.",
        "É proibido responder apenas com tópicos soltos. O formato deve parecer um parecer técnico institucional.",
      ].join("\n");

    case "risk_analysis":
      return [
        "MODO DE RESPOSTA ATIVO: ANÁLISE DE RISCO.",
        "OBEDEÇA AO FORMATO: a resposta deve mapear riscos, não virar orientação genérica.",
        "Estrutura obrigatória:",
        "1. Matriz de riscos em tópicos ou tabela.",
        "2. Para cada risco, indique: risco, probabilidade, impacto, consequência e mitigação.",
        "3. Finalize com prioridades de controle.",
        "Não escreva como resumo, parecer ou checklist simples.",
      ].join("\n");

    case "attention_points":
      return [
        "MODO DE RESPOSTA ATIVO: PONTOS DE ATENÇÃO.",
        "OBEDEÇA AO FORMATO: liste alertas objetivos e cuidados críticos.",
        "Estrutura obrigatória:",
        "Título: PONTOS DE ATENÇÃO",
        "Use tópicos curtos iniciados por 'Atenção:'.",
        "Destaque riscos de conformidade, documentação, prazos, responsabilidades e validações necessárias.",
        "Não transforme em plano de ação completo.",
      ].join("\n");

    case "action_plan":
      return [
        "MODO DE RESPOSTA ATIVO: PLANO DE AÇÃO.",
        "OBEDEÇA AO FORMATO: organize ações práticas em sequência operacional.",
        "Estrutura obrigatória:",
        "Use uma tabela em Markdown com as colunas: Etapa | Ação | Responsável sugerido | Prazo sugerido | Resultado esperado.",
        "Depois da tabela, inclua apenas 3 prioridades imediatas.",
        "Não escreva parecer, minuta ou resumo.",
      ].join("\n");

    case "draft":
      return [
        "MODO DE RESPOSTA ATIVO: MINUTA.",
        "OBEDEÇA AO FORMATO: produza um texto formal editável, pronto para adaptação pelo órgão.",
        "Estrutura obrigatória:",
        "1. Título da minuta.",
        "2. Texto em linguagem institucional.",
        "3. Campos faltantes entre colchetes, como [NOME DO ÓRGÃO], [DATA], [RESPONSÁVEL].",
        "4. Observação final de validação jurídica/técnica.",
        "Não responda com explicação longa; entregue a minuta.",
      ].join("\n");

    case "comparison":
      return [
        "MODO DE RESPOSTA ATIVO: COMPARATIVO.",
        "OBEDEÇA AO FORMATO: compare alternativas, cenários, regras ou caminhos.",
        "Estrutura obrigatória:",
        "Use uma tabela em Markdown com colunas adequadas ao tema, por exemplo: Critério | Opção A | Opção B | Observação.",
        "Depois da tabela, inclua uma conclusão comparativa objetiva.",
        "Não escreva como checklist ou parecer.",
      ].join("\n");

    case "manager_guidance":
      return [
        "MODO DE RESPOSTA ATIVO: ORIENTAÇÃO AO GESTOR.",
        "OBEDEÇA AO FORMATO: responda para apoiar decisão administrativa.",
        "Estrutura obrigatória:",
        "1. Decisão que o gestor precisa tomar.",
        "2. O que observar antes de decidir.",
        "3. Providências recomendadas.",
        "4. Riscos se nada for feito.",
        "5. Próximo passo sugerido.",
        "Use tom direto, executivo e prático.",
      ].join("\n");

    case "objective":
    default:
      return [
        "MODO DE RESPOSTA ATIVO: PADRÃO CONSULTIVO.",
        "Responda de forma natural, consultiva e didática.",
        "Comece com texto corrido explicando a lógica do tema.",
        "Depois, se útil, organize os principais pontos práticos.",
        "Não force formato de checklist, parecer, minuta, tabela ou plano de ação, salvo pedido expresso do usuário.",
      ].join("\n");
  }
}

function buildConversationContext(params: {
  organizationName: string;
  organizationId: string;
  conversation: GovernanceConversationForChat;
}) {
  const { organizationName, organizationId, conversation } = params;

  return [
    "CONTEXTO INSTITUCIONAL DO GOVERNANÇA",
    `- Organização: ${organizationName}`,
    `- organization_id: ${organizationId}`,
    `- Conversa: ${conversation.title}`,
    `- Categoria: ${conversation.category || "não informada"}`,
    `- Visibilidade: ${conversation.visibility}`,
    "",
    "REGRAS DE ISOLAMENTO",
    "- Responda apenas no contexto da organização atual.",
    "- Não presuma acesso a dados de outros órgãos.",
    "- Quando faltar informação local, diga que o órgão deve validar em sua base institucional ou norma própria.",
    "- Não afirme que consultou documentos institucionais se eles ainda não foram fornecidos nesta conversa.",
    "- Para temas jurídicos, contábeis, fiscais, licitatórios ou de controle, indique quando houver necessidade de revisão por área técnica competente.",
  ].join("\n");
}

function buildGovernanceConsultantStyleInstruction(mode: GovernanceResponseMode): string {
  if (mode !== "objective") {
    return [
      "REGRA DE PRIORIDADE DO MODO DE RESPOSTA",
      "O modo selecionado pelo usuário tem prioridade sobre o estilo consultivo geral.",
      "Não neutralize o formato escolhido.",
      "Se o modo for checklist, responda como checklist.",
      "Se o modo for parecer técnico, responda como parecer técnico.",
      "Se o modo for análise de risco, responda como análise de risco.",
      "Se o modo for minuta, entregue minuta.",
      "Se o modo for comparativo, use comparação clara.",
      "Mantenha clareza e segurança técnica, mas preserve a estrutura específica do modo selecionado.",
    ].join("\n");
  }

  return [
    "REGRA PRIORITÁRIA DE ESTILO DO GOVERNANÇA",
    "A resposta deve soar como uma conversa técnica com um consultor experiente, não como despacho, checklist, manual interno ou relatório de auditoria.",
    "Antes de listar providências, explique a lógica do tema em 2 a 4 frases curtas, com linguagem natural e didática.",
    "Use frases de transição, exemplo: 'Na prática...', 'O ponto central é...', 'Antes de abrir o processo...', 'Sem isso, o procedimento fica frágil...'.",
    "Explique o porquê das providências. O usuário precisa entender a razão administrativa, não apenas receber uma sequência de tarefas.",
    "Evite começar a resposta com lista numerada, tópicos ou blocos intitulados. Comece com uma orientação em texto corrido.",
    "Use listas somente depois da introdução, quando elas ajudarem a organizar a resposta.",
    "Quando usar listas, misture orientação com explicação curta. Não escreva itens secos.",
    "Não use aparência de checklist no modo Padrão. Checklist só quando o usuário pedir ou escolher modo Checklist.",
    "Evite excesso de seções como 'Riscos', 'Providências', 'Base legal' em toda resposta. Use apenas quando realmente agregarem valor.",
    "O tom desejado é fluido, seguro, didático e aplicável à rotina de uma prefeitura.",
  ].join("\n");
}

function buildFinalConsultativeOverride(mode: GovernanceResponseMode): string {
  if (mode === "technical_opinion") {
    return [
      "REGRA FINAL OBRIGATÓRIA PARA PARECER TÉCNICO",
      "A resposta deve iniciar obrigatoriamente com o título: PARECER TÉCNICO.",
      "Use exatamente os blocos: 1. ASSUNTO, 2. RELATÓRIO, 3. FUNDAMENTAÇÃO TÉCNICA, 4. ANÁLISE, 5. CONCLUSÃO e 6. RECOMENDAÇÃO TÉCNICA.",
      "É proibido responder como conversa consultiva, checklist, resumo, plano de ação ou minuta.",
      "Não use abertura genérica. Comece diretamente no formato de parecer.",
      "Mantenha linguagem formal, institucional e tecnicamente cautelosa.",
    ].join("\n");
  }

  if (mode !== "objective") {
    return [
      "REGRA FINAL OBRIGATÓRIA",
      `O modo selecionado é ${mode}. A resposta precisa ficar visual e estruturalmente diferente do modo Padrão.`,
      "Não comece com a mesma introdução genérica usada no modo Padrão.",
      "Não entregue uma orientação consultiva genérica se o modo exigir outro formato.",
      "Siga rigorosamente a estrutura indicada para o modo selecionado.",
    ].join("\n");
  }

  return [
    "REGRA FINAL OBRIGATÓRIA PARA O MODO PADRÃO",
    "No modo Padrão, a primeira parte da resposta deve ser texto corrido, explicativo e fluido.",
    "É proibido começar diretamente com '1.', '-', '•', tabela ou cabeçalho técnico.",
    "Formato desejado:",
    "1. Um parágrafo inicial contextualizando o tema.",
    "2. Um segundo parágrafo explicando a lógica administrativa.",
    "3. Só depois, se útil, uma lista com os pontos principais.",
    "4. Fechar com um cuidado prático ou orientação ao gestor.",
    "Escreva como o módulo Estratégico: didático, natural, gostoso de ler, mas tecnicamente seguro.",
  ].join("\n");
}

function mapMessagesToOpenAIInput(
  messages: GovernanceMessage[],
  options?: {
    currentMessageOnly?: boolean;
  },
): OpenAIInputMessage[] {
  const sourceMessages = options?.currentMessageOnly
    ? [...messages].reverse().filter((message) => message.role === "user").slice(0, 1).reverse()
    : messages;

  const relevantMessages = sourceMessages.filter((message) => {
    return message.role === "user" || message.role === "system";
  });

  return relevantMessages.map((message) => {
    if (message.role === "system") {
      return {
        role: "system",
        content: message.content,
      };
    }

    return {
      role: "user",
      content: message.content,
    };
  });
}


type GovernancePdfContextResult = {
  selectedPdfFileIds: string[];
  pdfContextText: string;
  pdfContextAvailable: boolean;
  pdfContextWarnings: string[];
};

type GovernancePdfFileRow = {
  id: string;
  file_name: string | null;
  extracted_text: string | null;
  extracted_text_status: string | null;
  vector_index_status: string | null;
  vector_chunks_count: number | null;
};

type GovernanceMatchPdfChunkRow = {
  chunk_index: number;
  content: string;
};

function clampText(text: string, maxChars: number) {
  const clean = String(text ?? "").trim();

  if (clean.length <= maxChars) {
    return clean;
  }

  return `${clean.slice(0, Math.max(0, maxChars - 20)).trim()}\n\n[texto cortado]`;
}

function normalizePdfText(text: string) {
  return String(text ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function buildGovernancePdfLabel(pdfRow: GovernancePdfFileRow) {
  const fileName = String(pdfRow.file_name ?? "").trim();
  return fileName || `PDF ${pdfRow.id}`;
}

async function getGovernancePdfQueryEmbedding(question: string) {
  if (!openai) {
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: question,
      encoding_format: "float",
    } as any);

    const embedding = (response as any)?.data?.[0]?.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      return null;
    }

    return embedding as number[];
  } catch (error) {
    console.error("[governance/chat] Erro ao gerar embedding da pergunta:", error);
    return null;
  }
}

async function buildGovernancePdfContextFromVector(
  client: ReturnType<typeof createWritableSupabaseRouteClient>,
  pdfRow: GovernancePdfFileRow,
  question: string,
  maxChars: number,
) {
  const vectorReady =
    String(pdfRow.vector_index_status ?? "").toLowerCase() === "ready" &&
    Number(pdfRow.vector_chunks_count ?? 0) > 0;

  if (!vectorReady) {
    return "";
  }

  const queryEmbedding = await getGovernancePdfQueryEmbedding(question);

  if (!queryEmbedding) {
    return "";
  }

  const { data: matches, error: matchError } = await client.rpc("match_pdf_chunks", {
    query_embedding: queryEmbedding,
    match_count: RAG_TOP_K,
    filter_pdf_file_id: pdfRow.id,
  } as any);

  if (matchError) {
    console.error("[governance/chat] Erro ao buscar chunks vetoriais do PDF:", {
      pdfFileId: pdfRow.id,
      error: matchError.message,
    });

    return "";
  }

  if (!Array.isArray(matches) || matches.length === 0) {
    return "";
  }

  const label = buildGovernancePdfLabel(pdfRow);

  const raw = (matches as GovernanceMatchPdfChunkRow[])
    .map((match, index) =>
      [
        `[${label}] Trecho ${index + 1} (chunk #${Number(match.chunk_index ?? 0)}):`,
        String(match.content ?? "").trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .filter((block) => block.trim().length > 0)
    .join("\n\n---\n\n");

  return clampText(raw, maxChars);
}

function buildGovernancePdfContextFromExtractedText(
  pdfRow: GovernancePdfFileRow,
  question: string,
  maxChars: number,
) {
  if (String(pdfRow.extracted_text_status ?? "").toLowerCase() !== "ready") {
    return "";
  }

  const text = normalizePdfText(pdfRow.extracted_text ?? "");

  if (!text) {
    return "";
  }

  const chunks = chunkText(text, {
    chunkSize: 1200,
    overlap: 200,
    maxChunks: 320,
  });

  const picked = pickRelevantChunks(chunks, question, {
    maxChunks: 4,
    maxChars,
    minScore: 1,
  });

  const chunksToUse = picked.length > 0 ? picked : chunks.slice(0, 4);

  if (!chunksToUse.length) {
    return "";
  }

  const label = buildGovernancePdfLabel(pdfRow);

  const raw = chunksToUse
    .map((chunk, index) =>
      [
        `[${label}] Trecho ${index + 1} (chunk #${chunk.index}):`,
        chunk.text,
      ].join("\n"),
    )
    .join("\n\n---\n\n");

  return clampText(raw, maxChars);
}

async function buildGovernancePdfContext({
  client,
  userId,
  selectedPdfFileIds,
  question,
}: {
  client: ReturnType<typeof createWritableSupabaseRouteClient>;
  userId: string;
  selectedPdfFileIds: string[];
  question: string;
}): Promise<GovernancePdfContextResult> {
  const uniquePdfFileIds = Array.from(new Set(selectedPdfFileIds))
    .map((id) => id.trim())
    .filter((id) => uuidRe.test(id))
    .slice(0, MAX_SELECTED_PDFS_IN_GOVERNANCE_CHAT);

  if (uniquePdfFileIds.length === 0) {
    return {
      selectedPdfFileIds: [],
      pdfContextText: "",
      pdfContextAvailable: false,
      pdfContextWarnings: [],
    };
  }

  const warnings: string[] = [];
  const contextBlocks: string[] = [];

  const { data: pdfRows, error: pdfRowsError } = await client
    .from("pdf_files")
    .select(
      `
        id,
        file_name,
        extracted_text,
        extracted_text_status,
        vector_index_status,
        vector_chunks_count
      `,
    )
    .eq("user_id", userId)
    .in("id", uniquePdfFileIds);

  if (pdfRowsError) {
    console.error("[governance/chat] Erro ao buscar PDFs selecionados:", pdfRowsError);
    return {
      selectedPdfFileIds: uniquePdfFileIds,
      pdfContextText: "",
      pdfContextAvailable: false,
      pdfContextWarnings: ["Não foi possível validar os PDFs selecionados."],
    };
  }

  const rowsById = new Map(
    ((pdfRows ?? []) as GovernancePdfFileRow[]).map((row) => [String(row.id), row]),
  );

  const maxCharsPerPdf = Math.max(
    900,
    Math.floor(MAX_GOVERNANCE_PDF_CONTEXT_CHARS / Math.max(1, uniquePdfFileIds.length)),
  );

  for (const pdfFileId of uniquePdfFileIds) {
    const pdf = rowsById.get(pdfFileId);
    const fileName = String(pdf?.file_name ?? "PDF selecionado");

    if (!pdf) {
      warnings.push(`PDF não encontrado ou sem permissão: ${pdfFileId}.`);
      continue;
    }

    const extractedStatus = String(pdf.extracted_text_status ?? "").toLowerCase();
    const vectorStatus = String(pdf.vector_index_status ?? "").toLowerCase();

    const vectorContext = await buildGovernancePdfContextFromVector(
      client,
      pdf,
      question,
      maxCharsPerPdf,
    );

    const extractedTextContext = vectorContext
      ? ""
      : buildGovernancePdfContextFromExtractedText(pdf, question, maxCharsPerPdf);

    const contextText = vectorContext || extractedTextContext;

    if (!contextText) {
      warnings.push(
        `Não encontrei trechos disponíveis no PDF "${fileName}". Status de texto: ${extractedStatus || "não informado"}. Status vetorial: ${vectorStatus || "não informado"}.`,
      );
      continue;
    }

    contextBlocks.push(
      [
        `PDF: ${fileName}`,
        `ID: ${pdfFileId}`,
        "",
        contextText,
      ].join("\n"),
    );
  }

  const pdfContextText = contextBlocks
    .join("\n\n---\n\n")
    .slice(0, MAX_GOVERNANCE_PDF_CONTEXT_CHARS);

  return {
    selectedPdfFileIds: uniquePdfFileIds,
    pdfContextText,
    pdfContextAvailable: pdfContextText.trim().length > 0,
    pdfContextWarnings: warnings,
  };
}

function normalizeContent(content: string) {
  return content.trim().slice(0, MAX_USER_MESSAGE_LENGTH);
}


function isDefaultConversationTitle(title: string | null | undefined) {
  const normalized = String(title ?? "").trim().toLowerCase();

  return (
    normalized === "" ||
    normalized === "nova conversa" ||
    normalized === "nova conversa institucional"
  );
}

function buildConversationTitleFromMessage(content: string) {
  const clean = String(content ?? "")
    .split("\nPDFs selecionados para esta pergunta:")[0]
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return "Conversa";
  }

  if (clean.length <= 54) {
    return clean;
  }

  return `${clean.slice(0, 54).trim()}...`;
}

async function updateConversationTitleFromMessage(params: {
  supabase: ReturnType<typeof createWritableSupabaseRouteClient>;
  conversation: GovernanceConversationForChat;
  organizationId: string;
  content: string;
}) {
  const { supabase, conversation, organizationId, content } = params;

  if (!isDefaultConversationTitle(conversation.title)) {
    return conversation.title;
  }

  const nextTitle = buildConversationTitleFromMessage(content);

  const { error } = await supabase
    .from("governance_conversations")
    .update({
      title: nextTitle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversation.id)
    .eq("organization_id", organizationId);

  if (error) {
    console.warn(
      "[governance/chat] Mensagem salva, mas não foi possível atualizar o título da conversa:",
      error,
    );

    return conversation.title;
  }

  conversation.title = nextTitle;

  return nextTitle;
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI não configurada. Verifique OPENAI_API_KEY." },
        { status: 500 },
      );
    }

    const supabase = createWritableSupabaseRouteClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      );
    }

    const context = await getCurrentGovernanceOrganization(user.id);

    if (!context) {
      return NextResponse.json(
        { error: "Usuário não vinculado a uma organização ativa." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | GovernanceChatRequestBody
      | null;

    const conversationId =
      typeof body?.conversationId === "string"
        ? body.conversationId.trim()
        : "";

    const rawContent =
      typeof body?.content === "string" ? body.content : "";

    const content = normalizeContent(rawContent);
    const selectedPdfAttachmentNames = Array.isArray(body?.selectedPdfAttachmentNames)
      ? body.selectedPdfAttachmentNames
          .filter((name): name is string => typeof name === "string")
          .map((name) => name.trim())
          .filter(Boolean)
      : [];

    const selectedPdfFileIds = Array.isArray(body?.selectedPdfFileIds)
      ? body.selectedPdfFileIds
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter((id) => uuidRe.test(id))
      : [];

    const requestedResponseMode = body?.responseMode;

    const hasSelectedPdfAttachments =
      selectedPdfAttachmentNames.length > 0 || selectedPdfFileIds.length > 0;

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversa institucional não informada." },
        { status: 400 },
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "Mensagem vazia. Digite um conteúdo antes de enviar." },
        { status: 400 },
      );
    }

    if (rawContent.trim().length > MAX_USER_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          error:
            "Mensagem muito longa. Reduza o texto ou envie o conteúdo como documento na base institucional futuramente.",
        },
        { status: 400 },
      );
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("governance_conversations")
      .select(
        `
          id,
          organization_id,
          user_id,
          title,
          category,
          response_mode,
          visibility,
          status,
          deleted_at
        `,
      )
      .eq("id", conversationId)
      .eq("organization_id", context.organization.id)
      .is("deleted_at", null)
      .neq("status", "deleted")
      .maybeSingle<GovernanceConversationForChat>();

    if (conversationError) {
      console.error(
        "[governance/chat] Erro ao validar conversa:",
        conversationError,
      );

      return NextResponse.json(
        { error: "Não foi possível validar a conversa institucional." },
        { status: 500 },
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa institucional não encontrada para este órgão." },
        { status: 404 },
      );
    }

    if (conversation.status !== "active") {
      return NextResponse.json(
        { error: "Esta conversa não está ativa para novas mensagens." },
        { status: 409 },
      );
    }

    const effectiveResponseMode = normalizeResponseMode(
      requestedResponseMode,
      conversation.response_mode,
    );

    if (effectiveResponseMode !== conversation.response_mode) {
      const { error: updateResponseModeError } = await supabase
        .from("governance_conversations")
        .update({
          response_mode: effectiveResponseMode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id)
        .eq("organization_id", context.organization.id);

      if (updateResponseModeError) {
        console.warn(
          "[governance/chat] Não foi possível atualizar o modo de resposta da conversa:",
          updateResponseModeError,
        );
      } else {
        conversation.response_mode = effectiveResponseMode;
      }
    }

    const { data: userMessage, error: userMessageError } = await supabase
      .from("governance_messages")
      .insert({
        organization_id: context.organization.id,
        conversation_id: conversation.id,
        user_id: user.id,
        role: "user",
        content,
        metadata: {
          source: "governance_chat",
          product_tier: "governance",
          response_mode: effectiveResponseMode,
          selected_pdf_attachment_names: selectedPdfAttachmentNames,
          selected_pdf_file_ids: selectedPdfFileIds,
        },
      })
      .select(
        `
          id,
          organization_id,
          conversation_id,
          user_id,
          role,
          content,
          metadata,
          created_at
        `,
      )
      .single<GovernanceMessage>();

    if (userMessageError || !userMessage) {
      console.error(
        "[governance/chat] Erro ao salvar mensagem do usuário:",
        userMessageError,
      );

      return NextResponse.json(
        { error: "Não foi possível salvar a mensagem do usuário." },
        { status: 500 },
      );
    }

    const conversationTitle = await updateConversationTitleFromMessage({
      supabase,
      conversation,
      organizationId: context.organization.id,
      content,
    });

    const pdfContextResult = await buildGovernancePdfContext({
      client: supabase,
      userId: user.id,
      selectedPdfFileIds,
      question: content,
    });

    const { data: recentHistoryData, error: historyError } = await supabase
      .from("governance_messages")
      .select(
        `
          id,
          organization_id,
          conversation_id,
          user_id,
          role,
          content,
          metadata,
          created_at
        `,
      )
      .eq("organization_id", context.organization.id)
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY_MESSAGES);

    if (historyError) {
      console.error(
        "[governance/chat] Erro ao carregar histórico:",
        historyError,
      );

      return NextResponse.json(
        { error: "Não foi possível carregar o histórico da conversa." },
        { status: 500 },
      );
    }

    const history = ((recentHistoryData ?? []) as GovernanceMessage[]).reverse();

    const scopedPrompt = buildProductScopedPrompt({
      productTier: "governance",
      responseMode: mapGovernanceModeToPromptMode(effectiveResponseMode),
    });

    const instructions = [
      scopedPrompt,
      "",
      buildConversationContext({
        organizationName: context.organization.name,
        organizationId: context.organization.id,
        conversation,
      }),
      "",
      buildGovernanceModeInstruction(effectiveResponseMode),
      "",
      buildGovernanceConsultantStyleInstruction(effectiveResponseMode),
      "",
      buildFinalConsultativeOverride(effectiveResponseMode),
      hasSelectedPdfAttachments
        ? [
            "REGRA PONTUAL PARA PDFS SELECIONADOS NESTA PERGUNTA:",
            "Use prioritariamente o conteúdo textual recuperado dos PDFs selecionados nesta pergunta.",
            "Ignore PDFs citados em mensagens anteriores desta conversa, salvo se o usuário pedir comparação ou histórico.",
            selectedPdfAttachmentNames.length > 0
              ? `Nomes informados pelo frontend: ${selectedPdfAttachmentNames.join(", ")}.`
              : "",
            pdfContextResult.selectedPdfFileIds.length > 0
              ? `IDs dos PDFs selecionados: ${pdfContextResult.selectedPdfFileIds.join(", ")}.`
              : "",
            pdfContextResult.pdfContextAvailable
              ? ["TRECHOS RECUPERADOS DOS PDFS SELECIONADOS:", pdfContextResult.pdfContextText].join("\n\n")
              : "Nenhum trecho textual dos PDFs selecionados foi recuperado para esta pergunta.",
            pdfContextResult.pdfContextWarnings.length > 0
              ? ["Avisos de recuperação dos PDFs:", ...pdfContextResult.pdfContextWarnings.map((warning) => `- ${warning}`)].join("\n")
              : "",
            "Se não houver trechos recuperados suficientes, diga isso com clareza. Não invente conteúdo dos PDFs.",
          ]
            .filter(Boolean)
            .join("\n")
        : "",
    ]
      .join("\n\n")
      .trim();

    const wantsStreaming = request.headers
      .get("accept")
      ?.includes("text/event-stream") === true;

    if (!wantsStreaming) {
      let assistantText = "";

      try {
        const response = await openai!.responses.create({
          model: OPENAI_MODEL_GOVERNANCE,
          instructions,
          input: mapMessagesToOpenAIInput(history, { currentMessageOnly: hasSelectedPdfAttachments }),
          temperature: 0.3,
        } as any);

        assistantText = response.output_text?.trim() ?? "";
      } catch (error) {
        console.error("[governance/chat] Erro OpenAI:", error);

        return NextResponse.json(
          { error: "Erro ao gerar resposta da IA institucional." },
          { status: 500 },
        );
      }

      if (!assistantText) {
        return NextResponse.json(
          { error: "A IA não retornou uma resposta válida." },
          { status: 500 },
        );
      }

      const { data: assistantMessage, error: assistantMessageError } =
        await supabase
          .from("governance_messages")
          .insert({
            organization_id: context.organization.id,
            conversation_id: conversation.id,
            user_id: null,
            role: "assistant",
            content: assistantText,
            metadata: {
              source: "openai",
              product_tier: "governance",
              model: OPENAI_MODEL_GOVERNANCE,
              response_mode: effectiveResponseMode,
              history_messages_used: hasSelectedPdfAttachments ? 1 : history.length,
              selected_pdf_attachment_names: selectedPdfAttachmentNames,
          selected_pdf_file_ids: selectedPdfFileIds,
              current_message_only_for_pdf: hasSelectedPdfAttachments,
              streaming: false,
            },
          })
          .select(
            `
              id,
              organization_id,
              conversation_id,
              user_id,
              role,
              content,
              metadata,
              created_at
            `,
          )
          .single<GovernanceMessage>();

      if (assistantMessageError || !assistantMessage) {
        console.error(
          "[governance/chat] Erro ao salvar resposta da IA:",
          assistantMessageError,
        );

        return NextResponse.json(
          { error: "A resposta foi gerada, mas não pôde ser salva." },
          { status: 500 },
        );
      }

      const { error: updateConversationError } = await supabase
        .from("governance_conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id)
        .eq("organization_id", context.organization.id);

      if (updateConversationError) {
        console.warn(
          "[governance/chat] Mensagens salvas, mas não foi possível atualizar a conversa:",
          updateConversationError,
        );
      }

      return NextResponse.json({
        userMessage,
        assistantMessage,
        conversationTitle,
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantText = "";

        function send(event: string, data: unknown) {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        }

        send("userMessage", { userMessage });

        try {
          const openaiStream = await openai!.responses.create({
            model: OPENAI_MODEL_GOVERNANCE,
            instructions,
            input: mapMessagesToOpenAIInput(history, { currentMessageOnly: hasSelectedPdfAttachments }),
            temperature: 0.3,
            stream: true,
          } as any);

          for await (const event of openaiStream as any) {
            if (event?.type === "response.output_text.delta") {
              const delta = String(event.delta ?? "");

              if (delta) {
                assistantText += delta;
                send("delta", { delta });
              }
            }
          }
        } catch (error) {
          console.error("[governance/chat] Erro OpenAI streaming:", error);
          send("error", {
            error: "Erro ao gerar resposta da IA institucional.",
          });
          controller.close();
          return;
        }

        assistantText = assistantText.trim();

        if (!assistantText) {
          send("error", {
            error: "A IA não retornou uma resposta válida.",
          });
          controller.close();
          return;
        }

        const { data: assistantMessage, error: assistantMessageError } =
          await supabase
            .from("governance_messages")
            .insert({
              organization_id: context.organization.id,
              conversation_id: conversation.id,
              user_id: null,
              role: "assistant",
              content: assistantText,
              metadata: {
                source: "openai",
                product_tier: "governance",
                model: OPENAI_MODEL_GOVERNANCE,
                response_mode: effectiveResponseMode,
                history_messages_used: hasSelectedPdfAttachments ? 1 : history.length,
                selected_pdf_attachment_names: selectedPdfAttachmentNames,
          selected_pdf_file_ids: selectedPdfFileIds,
                current_message_only_for_pdf: hasSelectedPdfAttachments,
                streaming: true,
              },
            })
            .select(
              `
                id,
                organization_id,
                conversation_id,
                user_id,
                role,
                content,
                metadata,
                created_at
              `,
            )
            .single<GovernanceMessage>();

        if (assistantMessageError || !assistantMessage) {
          console.error(
            "[governance/chat] Erro ao salvar resposta da IA:",
            assistantMessageError,
          );

          send("error", {
            error: "A resposta foi gerada, mas não pôde ser salva.",
          });
          controller.close();
          return;
        }

        const { error: updateConversationError } = await supabase
          .from("governance_conversations")
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.id)
          .eq("organization_id", context.organization.id);

        if (updateConversationError) {
          console.warn(
            "[governance/chat] Mensagens salvas, mas não foi possível atualizar a conversa:",
            updateConversationError,
          );
        }

        send("done", {
          userMessage,
          assistantMessage,
          conversationTitle,
        });

        controller.close();
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    console.error("[governance/chat] Erro inesperado:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao processar chat institucional." },
      { status: 500 },
    );
  }
}