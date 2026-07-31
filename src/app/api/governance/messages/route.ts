import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";
import { MAX_GOVERNANCE_USER_MESSAGE_LENGTH } from "@/lib/governance/chat/request";
import { saveGovernanceUserMessage } from "@/lib/governance/chat/persistence";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

export async function POST(request: Request) {
  try {
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

    const body = await request.json().catch(() => null);

    const conversationId =
      typeof body?.conversationId === "string"
        ? body.conversationId.trim()
        : "";

    const content =
      typeof body?.content === "string" ? body.content.trim() : "";

    if (!conversationId || !isUuid(conversationId)) {
      return NextResponse.json(
        { error: "Conversa institucional inválida." },
        { status: 400 },
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "Mensagem vazia. Digite um conteúdo antes de enviar." },
        { status: 400 },
      );
    }

    if (content.length > MAX_GOVERNANCE_USER_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          error: `Mensagem excede o limite de ${MAX_GOVERNANCE_USER_MESSAGE_LENGTH} caracteres.`,
        },
        { status: 413 },
      );
    }

    const clientRequestIdRaw =
      typeof body?.clientRequestId === "string"
        ? body.clientRequestId.trim()
        : request.headers.get("x-client-request-id")?.trim() ?? "";

    if (clientRequestIdRaw && !isUuid(clientRequestIdRaw)) {
      return NextResponse.json(
        { error: "clientRequestId inválido." },
        { status: 400 },
      );
    }

    const clientRequestId = clientRequestIdRaw || crypto.randomUUID();

    const { data: conversation, error: conversationError } = await supabase
      .from("governance_conversations")
      .select("id, organization_id, user_id, status, deleted_at")
      .eq("id", conversationId)
      .eq("organization_id", context.organization.id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .neq("status", "deleted")
      .maybeSingle();

    if (conversationError) {
      console.error(
        "[governance] Erro ao validar conversa institucional:",
        conversationError,
      );

      return NextResponse.json(
        { error: "Não foi possível validar a conversa institucional." },
        { status: 500 },
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa institucional não encontrada para este usuário." },
        { status: 404 },
      );
    }

    const {
      message,
      error: messageError,
      duplicate,
    } = await saveGovernanceUserMessage({
      supabase,
      organizationId: context.organization.id,
      conversationId: conversation.id,
      userId: user.id,
      content,
      responseMode: "objective",
      selectedPdfAttachmentNames: [],
      selectedPdfFileIds: [],
      clientRequestId,
      source: "governance_conversations_ui",
    });

    if (duplicate) {
      return NextResponse.json(
        {
          error: "Esta mensagem já foi recebida.",
          code: "GOVERNANCE_MESSAGE_DUPLICATE_REQUEST",
          clientRequestId,
          message,
        },
        { status: 409 },
      );
    }

    if (messageError || !message) {
      console.error("[governance] Erro ao salvar mensagem:", messageError);

      return NextResponse.json(
        {
          error: "Não foi possível salvar a mensagem institucional.",
          clientRequestId,
        },
        { status: 500 },
      );
    }

    const { error: updateConversationError } = await supabase
      .from("governance_conversations")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id)
      .eq("organization_id", context.organization.id)
      .eq("user_id", user.id);

    if (updateConversationError) {
      console.warn(
        "[governance] Mensagem salva, mas não foi possível atualizar a conversa:",
        updateConversationError,
      );
    }

    const response = NextResponse.json({
      message,
      clientRequestId,
    });
    response.headers.set("x-client-request-id", clientRequestId);
    response.headers.set("cache-control", "no-store");

    return response;
  } catch (error) {
    console.error("[governance] Erro inesperado ao enviar mensagem:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao enviar mensagem institucional." },
      { status: 500 },
    );
  }
}
