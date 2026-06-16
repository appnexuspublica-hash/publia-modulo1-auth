// src/app/api/public/share/[shareId]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareProduct = "standard" | "governance";

type PublicConversation = {
  id: string;
  title: string | null;
  created_at: string;
};

type PublicMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function normalizePublicMessages(messages: any[]): PublicMessage[] {
  return (messages ?? [])
    .map((m: any) => ({
      id: String(m.id ?? ""),
      role: m.role as "user" | "assistant" | "system",
      content: String(m.content ?? ""),
      created_at: String(m.created_at ?? ""),
    }))
    .filter((m) => {
      return (
        isUuid(m.id) &&
        Boolean(m.content.trim()) &&
        (m.role === "user" || m.role === "assistant" || m.role === "system")
      );
    });
}

async function findSharedConversation(admin: any, shareId: string) {
  const governanceResult = await admin
    .from("governance_conversations")
    .select("id, title, created_at")
    .eq("share_id", shareId)
    .eq("is_shared", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (governanceResult.error) {
    const schemaMissing = /governance_conversations|is_shared|share_id|deleted_at/i.test(
      governanceResult.error.message ?? "",
    );

    if (!schemaMissing) {
      return { error: governanceResult.error.message, status: 500 };
    }
  }

  if (governanceResult.data?.id) {
    return {
      product: "governance" as ShareProduct,
      conversationsTable: "governance_conversations",
      messagesTable: "governance_messages",
      conversation: governanceResult.data as PublicConversation,
    };
  }

  const standardResult = await admin
    .from("conversations")
    .select("id, title, created_at")
    .eq("share_id", shareId)
    .eq("is_shared", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (standardResult.error) {
    return { error: standardResult.error.message, status: 500 };
  }

  if (!standardResult.data?.id) {
    return { error: "Link público não encontrado.", status: 404 };
  }

  return {
    product: "standard" as ShareProduct,
    conversationsTable: "conversations",
    messagesTable: "messages",
    conversation: standardResult.data as PublicConversation,
  };
}

export async function GET(
  req: Request,
  { params }: { params: { shareId: string } },
) {
  try {
    const shareId = String(params?.shareId ?? "").trim();

    if (!shareId || !isUuid(shareId)) {
      return NextResponse.json({ error: "shareId inválido." }, { status: 400 });
    }

    const url = new URL(req.url);

    const messageId =
      String(url.searchParams.get("messageId") ?? "").trim() ||
      String(url.searchParams.get("m") ?? "").trim() ||
      null;

    if (messageId && !isUuid(messageId)) {
      return NextResponse.json({ error: "messageId inválido." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Env NEXT_PUBLIC_SUPABASE_URL ausente." },
        { status: 500 },
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Env SUPABASE_SERVICE_ROLE_KEY ausente." },
        { status: 500 },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const resolved = await findSharedConversation(admin, shareId);

    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const { product, messagesTable, conversation } = resolved;
    const conversationId = String(conversation.id).trim();

    if (messageId) {
      const { data: target, error: targetErr } = await admin
        .from(messagesTable)
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .eq("id", messageId)
        .maybeSingle();

      if (targetErr) {
        return NextResponse.json({ error: targetErr.message }, { status: 500 });
      }

      if (!target) {
        return NextResponse.json(
          { error: "Link público não encontrado." },
          { status: 404 },
        );
      }

      const publicTarget = target as PublicMessage;

      const { data: prevUser, error: prevErr } = await admin
        .from(messagesTable)
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .eq("role", "user")
        .lt("created_at", publicTarget.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevErr) {
        return NextResponse.json({ error: prevErr.message }, { status: 500 });
      }

      const messages = normalizePublicMessages([
        ...(prevUser ? [prevUser] : []),
        publicTarget,
      ]);

      return NextResponse.json(
        {
          product,
          conversation,
          conversationId,
          messages,
          __debug: {
            version: "public-share-message-slice-governance-aware-v3",
            product,
            shareId,
            conversationId,
            messageId,
            returnedCount: messages.length,
          },
        },
        { status: 200 },
      );
    }

    const { data: msgs, error: msgErr } = await admin
      .from(messagesTable)
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    const messages = normalizePublicMessages(msgs ?? []);

    return NextResponse.json(
      {
        product,
        conversation,
        conversationId,
        messages,
        __debug: {
          version: "public-share-full-governance-aware-v3",
          product,
          shareId,
          conversationId,
          returnedCount: messages.length,
        },
      },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Erro inesperado." },
      { status: 500 },
    );
  }
}