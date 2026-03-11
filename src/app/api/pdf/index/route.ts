// src/app/api/pdf/index/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { processPdfForIndexing } from "@/lib/pdf/processForIndexing";

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

function errToString(error: any) {
  if (!error) return "Erro desconhecido";
  if (typeof error === "string") return error;

  const msg = error?.message ? String(error.message) : "";
  const name = error?.name ? String(error.name) : "";

  return [name, msg].filter(Boolean).join(": ") || "Erro desconhecido";
}

function errToDetail(error: any) {
  const msg = errToString(error);
  const stack = typeof error?.stack === "string" ? error.stack : "";
  return { msg, stack };
}

export async function POST(req: Request) {
  const isDev = process.env.NODE_ENV !== "production";

  try {
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

    const body = await req.json().catch(() => null);
    const pdfFileId = String(body?.pdfFileId ?? "").trim();

    if (!pdfFileId || !uuidRe.test(pdfFileId)) {
      return NextResponse.json({ error: "pdfFileId inválido." }, { status: 400 });
    }

    const result = await processPdfForIndexing({
      client,
      userId,
      pdfFileId,
      isDev,
      resetBeforeProcessing: false,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    const { msg, stack } = errToDetail(error);

    console.error("[/api/pdf/index] Erro inesperado:", msg);
    if (stack) console.error(stack);

    return NextResponse.json(
      {
        error: "Erro inesperado ao processar PDF.",
        detail: msg,
        ...(isDev ? { stack } : {}),
      },
      { status: 500 }
    );
  }
}