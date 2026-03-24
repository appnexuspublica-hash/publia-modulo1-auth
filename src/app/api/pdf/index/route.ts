// src/app/api/pdf/index/route.ts
import { NextResponse } from "next/server";

import { getAccessSummary, syncEffectiveAccessStatus } from "@/lib/access-control";
import { processPdfForIndexing } from "@/lib/pdf/processForIndexing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PDF_UPLOAD_MAX_MB = Number(process.env.PDF_UPLOAD_MAX_MB ?? 30);

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
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type deve ser application/json." },
        { status: 415 }
      );
    }

    const client = await createSupabaseServerClient();

    const {
      data: { user },
      error: authErr,
    } = await client.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const userId = user.id;

    const accessSummary = await getAccessSummary(client, userId);

    if (!accessSummary) {
      return NextResponse.json(
        { error: "Não foi possível verificar o acesso da sua conta no momento." },
        { status: 500 }
      );
    }

    const accessDecision = await syncEffectiveAccessStatus(client, accessSummary);

    if (!accessDecision.allowed) {
      return NextResponse.json(
        {
          error:
            accessDecision.message ??
            "Seu plano atual não permite processar PDFs.",
          accessBlocked: true,
          accessStatus: accessDecision.effectiveStatus,
          access_status: accessDecision.effectiveStatus,
          reason: accessDecision.reason,
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const pdfFileId = String(body?.pdfFileId ?? "").trim();

    if (!pdfFileId || !uuidRe.test(pdfFileId)) {
      return NextResponse.json({ error: "pdfFileId inválido." }, { status: 400 });
    }

    const { data: pdfRow, error: pdfErr } = await client
      .from("pdf_files")
      .select("id, file_size, user_id")
      .eq("id", pdfFileId)
      .eq("user_id", userId)
      .maybeSingle();

    if (pdfErr) {
      return NextResponse.json(
        { error: "Erro ao validar PDF para indexação.", detail: pdfErr.message },
        { status: 500 }
      );
    }

    if (!pdfRow) {
      return NextResponse.json(
        { error: "PDF inválido ou sem permissão." },
        { status: 404 }
      );
    }

    const fileSize =
      typeof (pdfRow as any).file_size === "number" &&
      Number.isFinite((pdfRow as any).file_size)
        ? Number((pdfRow as any).file_size)
        : null;

    const uploadMaxBytes = PDF_UPLOAD_MAX_MB * 1024 * 1024;

    if (fileSize !== null && fileSize > uploadMaxBytes) {
      const sizeMb = (fileSize / (1024 * 1024)).toFixed(1);

      return NextResponse.json(
        {
          error: `PDF grande (${sizeMb} MB). Limite atual: ${PDF_UPLOAD_MAX_MB} MB.`,
          code: "PDF_TOO_LARGE",
          uploadMaxMb: PDF_UPLOAD_MAX_MB,
        },
        { status: 413 }
      );
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