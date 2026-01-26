// src/app/api/public/share/create/route.ts
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
    const conversationId = String(body?.conversationId ?? "").trim();

    if (!conversationId || !isUuid(conversationId)) {
      return NextResponse.json({ error: "conversationId inválido." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Env do Supabase ausente (public)." }, { status: 500 });
    }

    const cookieStore = cookies();

    // auth via cookies do usuário (pra validar dono da conversa)
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

    // admin (service role) pra consultar/gerar share sem brigar com RLS
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Env SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // confirma que a conversa é do usuário logado
    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });
    if (!conv) return NextResponse.json({ error: "Sem permissão para esta conversa." }, { status: 403 });

    // upsert garante 1 share por conversation_id (exige UNIQUE em conversation_id)
    const { data: shareRow, error: shareErr } = await admin
      .from("conversation_shares")
      .upsert({ conversation_id: conversationId }, { onConflict: "conversation_id" })
      .select("share_id")
      .single();

    if (shareErr) {
      return NextResponse.json(
        { error: shareErr.message, hint: "Verifique índice UNIQUE em conversation_id." },
        { status: 500 }
      );
    }

    const shareId = String((shareRow as any)?.share_id ?? "").trim();
    if (!shareId) return NextResponse.json({ error: "Falha ao gerar shareId." }, { status: 500 });

    return NextResponse.json({ shareId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
