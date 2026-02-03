import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    // ✅ compat: aceita conversationId (novo) OU messageId (legado)
    const conversationIdRaw = String(body?.conversationId ?? "").trim();
    const messageIdRaw = String(body?.messageId ?? "").trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Env do Supabase ausente." }, { status: 500 });
    }
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Env SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
    }

    // Auth do usuário via cookies (pra validar dono da conversa)
    const cookieStore = cookies();
    const auth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });

    const { data: u, error: uErr } = await auth.auth.getUser();
    if (uErr || !u?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const userId = u.user.id;

    // Admin (service role) para ignorar RLS no share público
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ✅ resolve conversationId
    let conversationId = "";

    if (conversationIdRaw && isUuid(conversationIdRaw)) {
      conversationId = conversationIdRaw;
    } else if (messageIdRaw && isUuid(messageIdRaw)) {
      // 🔁 legado: descobrir a conversation pelo messageId
      const { data: msgRow, error: msgErr } = await admin
        .from("messages")
        .select("conversation_id")
        .eq("id", messageIdRaw)
        .maybeSingle<{ conversation_id: string }>();

      if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

      const cid = String(msgRow?.conversation_id ?? "").trim();
      if (!cid || !isUuid(cid)) {
        return NextResponse.json({ error: "messageId inválido." }, { status: 400 });
      }

      conversationId = cid;
    } else {
      return NextResponse.json(
        { error: "conversationId inválido." },
        { status: 400 }
      );
    }

    // Confirma que a conversa é do usuário
    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle<{ id: string; user_id: string }>();

    if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });
    if (!conv) return NextResponse.json({ error: "Sem permissão para esta conversa." }, { status: 403 });

    // Se já existe share para essa conversa, devolve o mesmo
    const { data: existing, error: exErr } = await admin
      .from("conversation_shares")
      .select("share_id")
      .eq("conversation_id", conversationId)
      .maybeSingle<{ share_id: string }>();

    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });

    if (existing?.share_id && isUuid(existing.share_id)) {
      return NextResponse.json({ shareId: existing.share_id }, { status: 200 });
    }

    // Cria novo share
    const shareId = crypto.randomUUID();

    const { data: inserted, error: insErr } = await admin
      .from("conversation_shares")
      .insert({ conversation_id: conversationId, share_id: shareId })
      .select("share_id")
      .single<{ share_id: string }>();

    if (insErr) {
      // Em caso de corrida, tenta buscar novamente
      const { data: retry, error: retryErr } = await admin
        .from("conversation_shares")
        .select("share_id")
        .eq("conversation_id", conversationId)
        .maybeSingle<{ share_id: string }>();

      if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 });
      const retryId = String(retry?.share_id ?? "").trim();
      if (retryId && isUuid(retryId)) return NextResponse.json({ shareId: retryId }, { status: 200 });

      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    const finalShareId = String(inserted?.share_id ?? "").trim();
    if (!finalShareId || !isUuid(finalShareId)) {
      return NextResponse.json({ error: "Falha ao gerar shareId." }, { status: 500 });
    }

    return NextResponse.json({ shareId: finalShareId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
