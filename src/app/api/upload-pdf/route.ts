// src/app/api/upload-pdf/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

// ---------------------------------------------------------------------
// Supabase (service role) – ignora RLS NO BANCO, então precisamos validar ownership
// ---------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[/api/upload-pdf] Variáveis do Supabase faltando.", {
    hasUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
  });
} else {
  supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// --- helpers: auth via cookies do request ---
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
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase anon envs faltando");
  const jar = parseCookieHeader(req.headers.get("cookie"));
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return jar[name];
      },
      // nesta rota só lemos sessão; não precisamos set/remove
      set() {},
      remove() {},
    },
  });
}

// --- validações simples ---
const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Servidor não configurado (Supabase envs)." },
      { status: 500 }
    );
  }

  // (1) Content-Type: evita POST estranho
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type deve ser application/json." },
      { status: 415 }
    );
  }

  // 1) autentica usuário (cookie do Supabase)
  let userId: string | null = null;
  try {
    const auth = createAuthClient(req);
    const { data, error } = await auth.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    userId = data.user.id;
  } catch (e) {
    console.error("[/api/upload-pdf] erro ao autenticar:", e);
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Body JSON: { conversationId, fileName, fileSize, storagePath }
    const { conversationId, fileName, fileSize, storagePath } = body as {
      conversationId?: string;
      fileName?: string;
      fileSize?: number;
      storagePath?: string;
    };

    if (!conversationId || !storagePath) {
      return NextResponse.json(
        { error: "conversationId e storagePath são obrigatórios para registrar o PDF." },
        { status: 400 }
      );
    }

    // (2) valida UUID
    if (!uuidRe.test(conversationId)) {
      return NextResponse.json({ error: "conversationId inválido." }, { status: 400 });
    }

    // (3) valida storagePath esperado: `${conversationId}/...` + endurece contra path suspeito
    const badPath =
      !storagePath.startsWith(`${conversationId}/`) ||
      storagePath.includes("..") ||
      storagePath.includes("\\") ||
      storagePath.startsWith("/") ||
      storagePath.length > 300;

    if (badPath) {
      return NextResponse.json({ error: "storagePath inválido." }, { status: 400 });
    }

    // 2) valida que a conversa pertence ao usuário logado
    const client = supabase as any;

    const { data: conv, error: convError } = await client
      .from("conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (convError) {
      console.error("[/api/upload-pdf] erro ao validar conversa:", convError);
      return NextResponse.json({ error: "Falha ao validar conversa." }, { status: 500 });
    }

    if (!conv) {
      return NextResponse.json(
        { error: "Conversa inválida ou sem permissão." },
        { status: 403 }
      );
    }

    // 4) insere pdf_files SEM confiar em userId do client (sempre userId do auth)
    const { data, error } = await client
      .from("pdf_files")
      .insert(
        {
          conversation_id: conversationId,
          user_id: userId,
          file_name: fileName ?? null,
          storage_path: storagePath,
          file_size: typeof fileSize === "number" ? fileSize : null,
        } as any
      )
      .select("id, file_name, file_size")
      .single();

    if (error || !data) {
      console.error("[/api/upload-pdf] erro ao inserir em pdf_files:", error);
      return NextResponse.json(
        { error: "Não foi possível registrar o PDF no banco.", detail: error?.message ?? null },
        { status: 500 }
      );
    }

    const row = data as { id: string; file_name: string | null; file_size: number | null };

    return NextResponse.json({
      id: row.id,
      fileName: row.file_name ?? fileName ?? "",
      fileSize: row.file_size ?? fileSize ?? 0,
    });
  } catch (err) {
    console.error("[/api/upload-pdf] Erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao registrar o PDF no banco." },
      { status: 500 }
    );
  }
}
