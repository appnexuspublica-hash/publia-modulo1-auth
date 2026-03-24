// src/app/api/pdf/detach/route.ts
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type deve ser application/json." },
        { status: 415 }
      );
    }

    const client = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const userId = user.id;

    const body = await req.json().catch(() => null);
    const conversationId = String(body?.conversationId ?? "").trim();

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId é obrigatório." },
        { status: 400 }
      );
    }

    if (!uuidRe.test(conversationId)) {
      return NextResponse.json(
        { error: "conversationId inválido." },
        { status: 400 }
      );
    }

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
  } catch (error: any) {
    console.error("[/api/pdf/detach] erro inesperado:", error);

    return NextResponse.json(
      {
        error: "Erro inesperado ao desanexar PDF.",
        detail: String(error?.message ?? error ?? "Erro desconhecido"),
      },
      { status: 500 }
    );
  }
}