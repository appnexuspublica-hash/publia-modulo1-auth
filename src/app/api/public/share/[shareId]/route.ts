// src/app/api/public/share/[shareId]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: Request, { params }: { params: { shareId: string } }) {
  try {
    const shareId = String(params?.shareId ?? "").trim();
    if (!shareId || !isUuid(shareId)) {
      return NextResponse.json({ error: "shareId inválido." }, { status: 400 });
    }

    // ✅ recorte por mensagem
    const url = new URL(req.url);
    const messageId = String(url.searchParams.get("m") ?? "").trim() || null;
    if (messageId && !isUuid(messageId)) {
      return NextResponse.json({ error: "messageId inválido." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json({ error: "Env NEXT_PUBLIC_SUPABASE_URL ausente." }, { status: 500 });
    }
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Env SUPABASE_SERVICE_ROLE_KEY ausente." },
        { status: 500 }
      );
    }

    // Admin (service role) para permitir leitura pública SEM abrir RLS
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // shareId -> conversa compartilhada
    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .select("id, title, created_at")
      .eq("share_id", shareId)
      .eq("is_shared", true)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; title: string | null; created_at: string }>();

    if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });
    if (!conv?.id)
      return NextResponse.json({ error: "Link público não encontrado." }, { status: 404 });

    const conversationId = String(conv.id).trim();

    // ✅ Se tem messageId: retorna só recorte
    if (messageId) {
      const { data: target, error: targetErr } = await admin
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .eq("id", messageId)
        .maybeSingle<{
          id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        }>();

      if (targetErr) return NextResponse.json({ error: targetErr.message }, { status: 500 });
      if (!target)
        return NextResponse.json({ error: "Link público não encontrado." }, { status: 404 });

      // pega a pergunta imediatamente anterior (se existir)
      const { data: prevUser, error: prevErr } = await admin
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .eq("role", "user")
        .lt("created_at", target.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; role: "user"; content: string; created_at: string }>();

      if (prevErr) return NextResponse.json({ error: prevErr.message }, { status: 500 });

      const messages = [
        ...(prevUser ? [prevUser] : []),
        {
          id: String(target.id),
          role: target.role,
          content: String(target.content ?? ""),
          created_at: target.created_at,
        },
      ];

      return NextResponse.json(
        {
          conversation: conv,
          conversationId,
          messages,
          __debug: {
            version: "share-message-slice-v2",
            shareId,
            conversationId,
            messageId,
            returnedCount: messages.length,
          },
        },
        { status: 200 }
      );
    }

    // ✅ Sem messageId: retorna conversa inteira (comportamento padrão)
    const { data: msgs, error: msgErr } = await admin
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

    const messages = (msgs ?? []).map((m: any) => ({
      id: String(m.id),
      role: m.role as "user" | "assistant",
      content: String(m.content ?? ""),
      created_at: m.created_at as string,
    }));

    return NextResponse.json(
      {
        conversation: conv,
        conversationId,
        messages,
        __debug: {
          version: "share-full-v2",
          shareId,
          conversationId,
          returnedCount: messages.length,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
