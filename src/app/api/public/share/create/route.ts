//src/app/api/public/share/create/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function registerPublicShareEvent(
  supabase: any,
  params: {
    userId: string;
    conversationId: string;
    shareId: string;
    source: "conversationId" | "messageId";
    action: "existing" | "reactivated" | "created";
  }
) {
  const { userId, conversationId, shareId, source, action } = params;

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
    },
  });

  if (error) {
    console.error("[/api/public/share/create] erro ao registrar usage_events", error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const conversationIdRaw = String(body?.conversationId ?? "").trim();
    const messageIdRaw = String(body?.messageId ?? "").trim();

    const source: "conversationId" | "messageId" =
      conversationIdRaw && isUuid(conversationIdRaw) ? "conversationId" : "messageId";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Env do Supabase ausente." }, { status: 500 });
    }

    const cookieStore = cookies();

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

    let conversationId = "";

    if (conversationIdRaw && isUuid(conversationIdRaw)) {
      conversationId = conversationIdRaw;
    } else if (messageIdRaw && isUuid(messageIdRaw)) {
      const { data: msgRow, error: msgErr } = await supabase
        .from("messages")
        .select("conversation_id")
        .eq("id", messageIdRaw)
        .maybeSingle<{ conversation_id: string }>();

      if (msgErr) {
        return NextResponse.json({ error: msgErr.message }, { status: 500 });
      }

      const cid = String(msgRow?.conversation_id ?? "").trim();
      if (!cid || !isUuid(cid)) {
        return NextResponse.json({ error: "messageId inválido." }, { status: 400 });
      }

      conversationId = cid;
    } else {
      return NextResponse.json({ error: "conversationId inválido." }, { status: 400 });
    }

    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, is_shared, share_id")
      .eq("id", conversationId)
      .maybeSingle<{ id: string; is_shared: boolean; share_id: string | null }>();

    if (convErr) {
      return NextResponse.json({ error: convErr.message }, { status: 500 });
    }

    if (!conv) {
      return NextResponse.json(
        { error: "Sem permissão para esta conversa." },
        { status: 403 }
      );
    }

    const existingShareId = String(conv.share_id ?? "").trim();

    if (existingShareId && isUuid(existingShareId)) {
      if (conv.is_shared) {
        await registerPublicShareEvent(supabase, {
          userId,
          conversationId,
          shareId: existingShareId,
          source,
          action: "existing",
        });

        return NextResponse.json({ shareId: existingShareId }, { status: 200 });
      }

      const { error: upErr } = await supabase
        .from("conversations")
        .update({ is_shared: true })
        .eq("id", conversationId);

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }

      await registerPublicShareEvent(supabase, {
        userId,
        conversationId,
        shareId: existingShareId,
        source,
        action: "reactivated",
      });

      return NextResponse.json({ shareId: existingShareId }, { status: 200 });
    }

    const shareId = crypto.randomUUID();

    const { data: updated, error: updateErr } = await supabase
      .from("conversations")
      .update({ is_shared: true, share_id: shareId })
      .eq("id", conversationId)
      .select("share_id")
      .single<{ share_id: string }>();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const finalShareId = String(updated?.share_id ?? "").trim();
    if (!finalShareId || !isUuid(finalShareId)) {
      return NextResponse.json({ error: "Falha ao gerar shareId." }, { status: 500 });
    }

    await registerPublicShareEvent(supabase, {
      userId,
      conversationId,
      shareId: finalShareId,
      source,
      action: "created",
    });

    return NextResponse.json({ shareId: finalShareId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}