// src/app/api/pdf/detach/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function parseCookieHeader(cookieHeader: string | null) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const p = part.trim();
    if (!p) continue;
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function createAuthClient(req: Request) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase envs faltando");
  const jar = parseCookieHeader(req.headers.get("cookie"));
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return jar[name];
      },
      set() {},
      remove() {},
    },
  });
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Servidor não configurado (Supabase envs)." },
      { status: 500 }
    );
  }

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type deve ser application/json." }, { status: 415 });
  }

  const client = createAuthClient(req) as any;

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const userId = authData.user.id;

  const body = await req.json().catch(() => null);
  const conversationId = String(body?.conversationId ?? "").trim();

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId é obrigatório." }, { status: 400 });
  }

  if (!uuidRe.test(conversationId)) {
    return NextResponse.json({ error: "conversationId inválido." }, { status: 400 });
  }

  // ✅ Desanexa de verdade: conversa deixa de usar PDF
  const { error } = await client
    .from("conversations")
    .update({ active_pdf_file_id: null, pdf_enabled: false } as any)
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) {
    console.error("[/api/pdf/detach] erro ao desanexar:", error);
    return NextResponse.json(
      { error: "Falha ao desanexar PDF.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
