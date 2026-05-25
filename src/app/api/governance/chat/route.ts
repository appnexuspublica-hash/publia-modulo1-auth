// src/app/api/governance/chat/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";
import { buildProductScopedPrompt } from "@/lib/publiaPrompt";
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

const MAX_USER_MESSAGE_LENGTH = 12000;
const MAX_HISTORY_MESSAGES = 30;

let openai: OpenAI | null = null;

if (!openaiApiKey) {
  console.error("[/api/governance/chat] OPENAI_API_KEY não está definida.");
} else {
  openai = new OpenAI({ apiKey: openaiApiKey });
}

type GovernanceChatRequestBody = {
  conversationId?: string;
  content?: string;
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
        "Modo institucional selecionado: RESUMO.",
        "Responda de forma sintética, organizada e tecnicamente segura.",
        "Destaque contexto, conclusão e providências principais.",
      ].join("\n");

    case "checklist":
      return [
        "Modo institucional selecionado: CHECKLIST.",
        "Estruture a resposta em itens verificáveis.",
        "Quando adequado, separe por etapas, responsáveis, documentos e riscos.",
      ].join("\n");

    case "technical_opinion":
      return [
        "Modo institucional selecionado: PARECER TÉCNICO.",
        "Estruture a resposta como análise técnica institucional.",
        "Inclua contexto, fundamentos, análise, riscos, conclusão e recomendações.",
        "Não invente norma local. Quando faltar dado, indique a necessidade de validação pelo órgão.",
      ].join("\n");

    case "risk_analysis":
      return [
        "Modo institucional selecionado: ANÁLISE DE RISCO.",
        "Identifique riscos jurídicos, administrativos, financeiros, operacionais e de controle.",
        "Quando possível, classifique riscos por criticidade e sugira medidas mitigadoras.",
      ].join("\n");

    case "attention_points":
      return [
        "Modo institucional selecionado: PONTOS DE ATENÇÃO.",
        "Liste alertas objetivos, cuidados de conformidade e pontos que exigem validação.",
      ].join("\n");

    case "action_plan":
      return [
        "Modo institucional selecionado: PLANO DE AÇÃO.",
        "Organize a resposta em ações, responsáveis sugeridos, prazos e próximos passos.",
      ].join("\n");

    case "draft":
      return [
        "Modo institucional selecionado: MINUTA.",
        "Produza texto em formato editável, com campos entre colchetes quando faltarem dados.",
        "Use linguagem formal, institucional e adequada à administração pública.",
      ].join("\n");

    case "comparison":
      return [
        "Modo institucional selecionado: COMPARATIVO.",
        "Compare alternativas, cenários ou entendimentos de forma organizada.",
        "Quando útil, use tabela em Markdown.",
      ].join("\n");

    case "manager_guidance":
      return [
        "Modo institucional selecionado: ORIENTAÇÃO AO GESTOR.",
        "Responda com foco em decisão administrativa, governança, riscos e providências práticas.",
      ].join("\n");

    case "objective":
    default:
      return [
        "Modo institucional selecionado: OBJETIVO.",
        "Responda com clareza, objetividade, linguagem técnica e foco prático.",
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

function mapMessagesToOpenAIInput(
  messages: GovernanceMessage[],
): OpenAIInputMessage[] {
  return messages.map((message) => {
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content,
      };
    }

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

function normalizeContent(content: string) {
  return content.trim().slice(0, MAX_USER_MESSAGE_LENGTH);
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
          response_mode: conversation.response_mode,
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
      responseMode: mapGovernanceModeToPromptMode(conversation.response_mode),
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
      buildGovernanceModeInstruction(conversation.response_mode),
    ]
      .join("\n\n")
      .trim();

    let assistantText = "";

    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL_GOVERNANCE,
        instructions,
        input: mapMessagesToOpenAIInput(history),
      });

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
            response_mode: conversation.response_mode,
            history_messages_used: history.length,
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
    });
  } catch (error) {
    console.error("[governance/chat] Erro inesperado:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao processar chat institucional." },
      { status: 500 },
    );
  }
}