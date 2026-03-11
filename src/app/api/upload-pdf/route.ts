// src/app/api/upload-pdf/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PDF_EXTRACT_MAX_MB = Number(process.env.PDF_EXTRACT_MAX_MB ?? 12);

function nowIso() {
  return new Date().toISOString();
}

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
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase envs faltando");
  }

  const jar = parseCookieHeader(req.headers.get("cookie"));

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name) => jar[name],
      set() {},
      remove() {},
    },
  });
}

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Servidor não configurado (Supabase envs)." },
      { status: 500 }
    );
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type deve ser application/json." },
      { status: 415 }
    );
  }

  const client = createAuthClient(req) as any;

  const { data: auth, error: authErr } = await client.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const userId = auth.user.id;

  try {
    const body = await req.json();

    const { conversationId, fileName, fileSize, storagePath } = body as {
      conversationId?: string;
      fileName?: string;
      fileSize?: number;
      storagePath?: string;
    };

    if (!conversationId || !storagePath) {
      return NextResponse.json(
        { error: "conversationId e storagePath são obrigatórios." },
        { status: 400 }
      );
    }

    if (!uuidRe.test(conversationId)) {
      return NextResponse.json({ error: "conversationId inválido." }, { status: 400 });
    }

    const invalidPath =
      !storagePath.startsWith(`${conversationId}/`) ||
      storagePath.includes("..") ||
      storagePath.includes("\\") ||
      storagePath.startsWith("/") ||
      storagePath.length > 300;

    if (invalidPath) {
      return NextResponse.json({ error: "storagePath inválido." }, { status: 400 });
    }

    const { data: conv } = await client
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!conv) {
      return NextResponse.json(
        { error: "Conversa inválida ou sem permissão." },
        { status: 403 }
      );
    }

    const sizeNum = typeof fileSize === "number" && Number.isFinite(fileSize) ? fileSize : null;

    const { data: inserted, error: insErr } = await client
      .from("pdf_files")
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        file_name: fileName ?? null,
        storage_path: storagePath,
        file_size: sizeNum,
        extracted_text_status: "pending",
        extracted_text_error: null,
        extracted_text_updated_at: nowIso(),
        vector_index_status: "pending",
        vector_index_error: null,
        vector_chunks_count: 0,
        vector_index_updated_at: nowIso(),
      } as any)
      .select("id, file_name, file_size")
      .single();

    if (insErr || !inserted) {
      return NextResponse.json(
        { error: "Falha ao registrar pdf_files.", detail: insErr?.message ?? null },
        { status: 500 }
      );
    }

    const row = inserted as {
      id: string;
      file_name: string | null;
      file_size: number | null;
    };

    await client
      .from("conversations")
      .update({ active_pdf_file_id: row.id, pdf_enabled: true } as any)
      .eq("id", conversationId)
      .eq("user_id", userId);

    return NextResponse.json({
      id: row.id,
      fileName: row.file_name ?? fileName ?? "",
      fileSize: Number(row.file_size ?? fileSize ?? 0),
      extractedTextStatus: "pending",
      vectorIndexStatus: "pending",
      extractMaxMb: PDF_EXTRACT_MAX_MB,
    });
  } catch (error: any) {
    console.error("[/api/upload-pdf] erro inesperado:", error);

    return NextResponse.json(
      {
        error: "Erro inesperado ao registrar o PDF.",
        detail: String(error?.message ?? error),
      },
      { status: 500 }
    );
  }
}