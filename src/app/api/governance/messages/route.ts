// src/app/api/governance/messages/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";

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

    const { data: conversation, error: conversationError } = await supabase
      .from("governance_conversations")
      .select("id, organization_id, user_id, status, deleted_at")
      .eq("id", conversationId)
      .eq("organization_id", context.organization.id)
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
        { error: "Conversa institucional não encontrada para este órgão." },
        { status: 404 },
      );
    }

    const { data: message, error: messageError } = await supabase
      .from("governance_messages")
      .insert({
        organization_id: context.organization.id,
        conversation_id: conversation.id,
        user_id: user.id,
        role: "user",
        content,
        metadata: {
          source: "governance_conversations_ui",
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
      .single();

    if (messageError) {
      console.error("[governance] Erro ao salvar mensagem:", messageError);

      return NextResponse.json(
        { error: "Não foi possível salvar a mensagem institucional." },
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
        "[governance] Mensagem salva, mas não foi possível atualizar a conversa:",
        updateConversationError,
      );
    }

    return NextResponse.json({
      message,
    });
  } catch (error) {
    console.error("[governance] Erro inesperado ao enviar mensagem:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao enviar mensagem institucional." },
      { status: 500 },
    );
  }
}