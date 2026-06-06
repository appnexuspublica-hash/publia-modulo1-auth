// src/app/api/public/share/create/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareProduct = "standard" | "governance";
type ShareSource = "conversationId" | "messageId";
type ShareAction = "existing" | "reactivated" | "created";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function getShareUrl(
  req: Request,
  product: ShareProduct,
  shareId: string,
  messageId?: string,
) {
  const origin = new URL(req.url).origin;
  const path =
    product === "governance"
      ? `/governanca/share/${shareId}`
      : `/share/${shareId}`;

  const url = new URL(path, origin);

  if (messageId && isUuid(messageId)) {
    url.searchParams.set("messageId", messageId);
  }

  return url.toString();
}

async function registerPublicShareEvent(
  supabase: any,
  params: {
    userId: string;
    conversationId: string;
    shareId: string;
    source: ShareSource;
    action: ShareAction;
    product: ShareProduct;
    messageId?: string | null;
  },
) {
  const { userId, conversationId, shareId, source, action, product, messageId } = params;

  const { error } = await supabase.from("usage_events").insert({
    user_id: userId,
    event_type: "public_share",
    conversation_id: conversationId,
    input_tokens: 0,
    output_tokens: 0,
    metadata: {
      shareId,
      source,
      action,
      product,
      ...(messageId ? { messageId } : {}),
    },
  });

  if (error) {
    console.error("[/api/public/share/create] erro ao registrar usage_events", error);
  }
}

async function resolveConversationIdFromMessage(
  supabase: any,
  params: {
    messagesTable: string;
    messageId: string;
  },
) {
  const { messagesTable, messageId } = params;

  const { data: msgRow, error: msgErr } = await supabase
    .from(messagesTable)
    .select("id, conversation_id")
    .eq("id", messageId)
    .maybeSingle();

  if (msgErr) {
    return {
      conversationId: "",
      messageId: "",
      error: msgErr.message,
    };
  }

  const resolvedMessageId = String((msgRow as { id?: string } | null)?.id ?? "").trim();
  const conversationId = String(
    (msgRow as { conversation_id?: string } | null)?.conversation_id ?? "",
  ).trim();

  if (!resolvedMessageId || !isUuid(resolvedMessageId)) {
    return {
      conversationId: "",
      messageId: "",
      error: "messageId inválido.",
    };
  }

  if (!conversationId || !isUuid(conversationId)) {
    return {
      conversationId: "",
      messageId: "",
      error: "messageId inválido.",
    };
  }

  return {
    conversationId,
    messageId: resolvedMessageId,
    error: null,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const productRaw = String(body?.product ?? "standard").trim();
    const product: ShareProduct =
      productRaw === "governance" ? "governance" : "standard";

    const conversationIdRaw = String(body?.conversationId ?? "").trim();
    const messageIdRaw = String(body?.messageId ?? "").trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Env do Supabase ausente." }, { status: 500 });
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });

    const { data: u, error: uErr } = await supabase.auth.getUser();

    if (uErr || !u?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const userId = u.user.id;

    const conversationsTable =
      product === "governance" ? "governance_conversations" : "conversations";

    const messagesTable =
      product === "governance" ? "governance_messages" : "messages";

    let source: ShareSource = "conversationId";
    let conversationId = "";
    let targetMessageId: string | null = null;

    if (messageIdRaw && isUuid(messageIdRaw)) {
      const resolved = await resolveConversationIdFromMessage(supabase, {
        messagesTable,
        messageId: messageIdRaw,
      });

      if (resolved.error) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }

      conversationId = resolved.conversationId;
      targetMessageId = resolved.messageId;
      source = "messageId";
    } else if (conversationIdRaw && isUuid(conversationIdRaw)) {
      conversationId = conversationIdRaw;
      source = "conversationId";
    } else {
      return NextResponse.json({ error: "conversationId inválido." }, { status: 400 });
    }

    const { data: conv, error: convErr } = await supabase
      .from(conversationsTable)
      .select("id, user_id, is_shared, share_id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (convErr) {
      const missingShareColumn =
        product === "governance" &&
        /is_shared|share_id|shared_at/i.test(convErr.message ?? "");

      return NextResponse.json(
        {
          error: missingShareColumn
            ? "Compartilhamento público do Governança ainda não está habilitado no banco. Rode a migration das colunas is_shared, share_id e shared_at em governance_conversations."
            : convErr.message,
          code: missingShareColumn
            ? "GOVERNANCE_PUBLIC_SHARE_SCHEMA_MISSING"
            : "PUBLIC_SHARE_CONVERSATION_ERROR",
          detail: convErr.message,
        },
        { status: missingShareColumn ? 409 : 500 },
      );
    }

    if (!conv) {
      return NextResponse.json(
        { error: "Sem permissão para esta conversa." },
        { status: 403 },
      );
    }

    const conversation = conv as {
      id: string;
      user_id: string;
      is_shared: boolean;
      share_id: string | null;
    };

    const existingShareId = String(conversation.share_id ?? "").trim();

    if (existingShareId && isUuid(existingShareId)) {
      if (conversation.is_shared) {
        await registerPublicShareEvent(supabase, {
          userId,
          conversationId,
          shareId: existingShareId,
          source,
          action: "existing",
          product,
          messageId: targetMessageId,
        });

        return NextResponse.json(
          {
            shareId: existingShareId,
            shareUrl: getShareUrl(req, product, existingShareId, targetMessageId ?? undefined),
            conversationId,
            messageId: targetMessageId,
          },
          { status: 200 },
        );
      }

      const updatePayload =
        product === "governance"
          ? { is_shared: true, shared_at: new Date().toISOString() }
          : { is_shared: true };

      const { error: upErr } = await supabase
        .from(conversationsTable)
        .update(updatePayload)
        .eq("id", conversationId)
        .eq("user_id", userId);

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }

      await registerPublicShareEvent(supabase, {
        userId,
        conversationId,
        shareId: existingShareId,
        source,
        action: "reactivated",
        product,
        messageId: targetMessageId,
      });

      return NextResponse.json(
        {
          shareId: existingShareId,
          shareUrl: getShareUrl(req, product, existingShareId, targetMessageId ?? undefined),
          conversationId,
          messageId: targetMessageId,
        },
        { status: 200 },
      );
    }

    const shareId = crypto.randomUUID();

    const updatePayload =
      product === "governance"
        ? {
            is_shared: true,
            share_id: shareId,
            shared_at: new Date().toISOString(),
          }
        : {
            is_shared: true,
            share_id: shareId,
          };

    const { data: updated, error: updateErr } = await supabase
      .from(conversationsTable)
      .update(updatePayload)
      .eq("id", conversationId)
      .eq("user_id", userId)
      .select("share_id")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const finalShareId = String((updated as { share_id?: string } | null)?.share_id ?? "").trim();

    if (!finalShareId || !isUuid(finalShareId)) {
      return NextResponse.json({ error: "Falha ao gerar shareId." }, { status: 500 });
    }

    await registerPublicShareEvent(supabase, {
      userId,
      conversationId,
      shareId: finalShareId,
      source,
      action: "created",
      product,
      messageId: targetMessageId,
    });

    return NextResponse.json(
      {
        shareId: finalShareId,
        shareUrl: getShareUrl(req, product, finalShareId, targetMessageId ?? undefined),
        conversationId,
        messageId: targetMessageId,
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
