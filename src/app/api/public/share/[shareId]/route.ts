// src/app/api/public/share/[shareId]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(_req: Request, { params }: { params: { shareId: string } }) {
  const shareId = String(params?.shareId ?? "").trim();

  if (!shareId || !isUuid(shareId)) {
    return NextResponse.json({ error: "shareId inválido." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Configuração do servidor incompleta (Supabase envs)." },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: shareRow, error: shareErr } = await admin
    .from("conversation_shares")
    .select("conversation_id")
    .eq("share_id", shareId)
    .maybeSingle<{ conversation_id: string }>();

  if (shareErr) return NextResponse.json({ error: shareErr.message }, { status: 500 });
  if (!shareRow?.conversation_id) return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });

  const conversationId = shareRow.conversation_id;

  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .select("id, title, created_at")
    .eq("id", conversationId)
    .maybeSingle<{ id: string; title: string | null; created_at: string }>();

  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });

  const { data: msgs, error: msgsErr } = await admin
    .from("messages")
    .select("id, role, content, created_at, conversation_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgsErr) return NextResponse.json({ error: msgsErr.message }, { status: 500 });

  return NextResponse.json({
    conversation: conv,
    messages: (msgs ?? []).map((m: any) => ({
      id: String(m.id),
      role: m.role,
      content: String(m.content ?? ""),
      created_at: String(m.created_at ?? ""),
    })),
  });
}
