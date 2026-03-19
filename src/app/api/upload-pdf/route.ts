// src/app/api/upload-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAccessSummary } from "@/lib/access-control";

const PDF_UPLOAD_MAX_MB = 30;
const TRIAL_PDF_LIMIT = 10;
const SUBSCRIPTION_PDF_LIMIT_MONTH = 25;

type PdfPeriod = "account" | "month" | null;

type AccessStatus =
  | "trial_active"
  | "trial_expired"
  | "subscription_active"
  | "subscription_expired";

type PdfUploadPlanValidation = {
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  period: PdfPeriod;
  blockedMessage: string | null;
  accessStatus: AccessStatus;
};

type UploadPdfRequestBody = {
  conversationId?: string;
  fileName?: string;
  storagePath?: string;
  filePath?: string;
  fileSize?: number;
  fileSizeBytes?: number;
  mimeType?: string;
};

function getMonthRangeUtc() {
  const now = new Date();

  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  );

  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  );

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

async function countUserPdfsAllTime(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  const { count, error } = await supabase
    .from("pdf_files")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Erro ao contar PDFs da conta: ${error.message}`);
  }

  return count ?? 0;
}

async function countUserPdfsThisMonth(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  const { startIso, endIso } = getMonthRangeUtc();

  const { count, error } = await supabase
    .from("pdf_files")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (error) {
    throw new Error(`Erro ao contar PDFs do mês: ${error.message}`);
  }

  return count ?? 0;
}

async function validatePdfUploadByPlan(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<PdfUploadPlanValidation> {
  const access = await getAccessSummary(supabase, userId);

  if (!access) {
    return {
      allowed: false,
      limit: null,
      used: 0,
      remaining: 0,
      period: null,
      blockedMessage:
        "Não foi possível validar o acesso da sua conta no momento.",
      accessStatus: "trial_expired",
    };
  }

  const accessStatus = access.access_status as AccessStatus;

  if (accessStatus === "trial_expired") {
    return {
      allowed: false,
      limit: null,
      used: 0,
      remaining: 0,
      period: null,
      blockedMessage:
        "Seu período de teste expirou. Assine um plano para enviar novos PDFs.",
      accessStatus,
    };
  }

  if (accessStatus === "subscription_expired") {
    return {
      allowed: false,
      limit: null,
      used: 0,
      remaining: 0,
      period: null,
      blockedMessage:
        "Sua assinatura expirou. Renove para voltar a enviar novos PDFs.",
      accessStatus,
    };
  }

  if (accessStatus === "trial_active") {
    const used = await countUserPdfsAllTime(supabase, userId);
    const limit = TRIAL_PDF_LIMIT;
    const remaining = Math.max(limit - used, 0);

    return {
      allowed: used < limit,
      limit,
      used,
      remaining,
      period: "account",
      blockedMessage:
        used >= limit
          ? `Você atingiu o limite de ${limit} PDFs no trial. Assine um plano para continuar.`
          : null,
      accessStatus,
    };
  }

  const used = await countUserPdfsThisMonth(supabase, userId);
  const limit = SUBSCRIPTION_PDF_LIMIT_MONTH;
  const remaining = Math.max(limit - used, 0);

  return {
    allowed: used < limit,
    limit,
    used,
    remaining,
    period: "month",
    blockedMessage:
      used >= limit
        ? `Você atingiu o limite de ${limit} PDFs neste mês no seu plano atual.`
        : null,
    accessStatus: "subscription_active",
  };
}

async function registerPdfUploadEvent(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  fileName: string;
  storagePath: string;
  fileSizeBytes: number;
  accessStatus: AccessStatus;
  pdfLimit: number | null;
  pdfUsed: number;
  pdfRemaining: number | null;
  pdfPeriod: PdfPeriod;
  conversationId: string | null;
}) {
  const {
    supabase,
    userId,
    fileName,
    storagePath,
    fileSizeBytes,
    accessStatus,
    pdfLimit,
    pdfUsed,
    pdfRemaining,
    pdfPeriod,
    conversationId,
  } = params;

  const payload = {
    user_id: userId,
    event_type: "pdf_upload",
    feature_key: "pdf_upload",
    value: 1,
    metadata: {
      conversation_id: conversationId,
      file_name: fileName,
      storage_path: storagePath,
      file_size_bytes: fileSizeBytes,
      access_status: accessStatus,
      pdf_limit: pdfLimit,
      pdf_used: pdfUsed,
      pdf_remaining: pdfRemaining,
      pdf_period: pdfPeriod,
    },
  };

  const { error } = await supabase.from("usage_events").insert(payload as never);

  if (error) {
    console.error("Erro ao registrar usage_events(pdf_upload):", error.message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as UploadPdfRequestBody;

    const conversationId = String(body.conversationId ?? "").trim();
    const fileName = String(body.fileName ?? "").trim();
    const storagePath = String(body.storagePath ?? body.filePath ?? "").trim();
    const fileSizeBytes = Number(body.fileSize ?? body.fileSizeBytes ?? 0);

    if (!conversationId || !fileName || !storagePath || !fileSizeBytes) {
      return NextResponse.json(
        {
          error:
            "Dados inválidos para registrar o PDF. Envie conversationId, fileName, storagePath/filePath e fileSize/fileSizeBytes.",
        },
        { status: 400 }
      );
    }

    const maxBytes = PDF_UPLOAD_MAX_MB * 1024 * 1024;

    if (fileSizeBytes > maxBytes) {
      return NextResponse.json(
        { error: `O PDF excede o limite de ${PDF_UPLOAD_MAX_MB} MB.` },
        { status: 400 }
      );
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (conversationError) {
      console.error("Erro ao validar conversa do PDF:", conversationError.message);
      return NextResponse.json(
        { error: "Não foi possível validar a conversa do PDF." },
        { status: 500 }
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa inválida para vincular o PDF." },
        { status: 400 }
      );
    }

    const planValidation = await validatePdfUploadByPlan(supabase, user.id);

    if (!planValidation.allowed) {
      return NextResponse.json(
        {
          error:
            planValidation.blockedMessage ??
            "Seu plano atual não permite enviar novos PDFs.",
          accessStatus: planValidation.accessStatus,
          pdfUsage: {
            limit: planValidation.limit,
            used: planValidation.used,
            remaining: planValidation.remaining,
            period: planValidation.period,
          },
        },
        { status: 403 }
      );
    }

    const pdfInsertPayload = {
      user_id: user.id,
      conversation_id: conversationId,
      file_name: fileName,
      storage_path: storagePath,
      file_size: fileSizeBytes,
    };

    const { data: insertedPdf, error: insertError } = await supabase
      .from("pdf_files")
      .insert(pdfInsertPayload as never)
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao salvar pdf_files:", insertError.message);

      return NextResponse.json(
        { error: "Não foi possível registrar o PDF no banco." },
        { status: 500 }
      );
    }

    const { error: conversationUpdateError } = await supabase
      .from("conversations")
      .update({
        active_pdf_file_id: (insertedPdf as { id: string }).id,
        pdf_enabled: true,
      } as never)
      .eq("id", conversationId)
      .eq("user_id", user.id);

    if (conversationUpdateError) {
      console.error(
        "Erro ao atualizar conversa com PDF ativo:",
        conversationUpdateError.message
      );
    }

    await registerPdfUploadEvent({
      supabase,
      userId: user.id,
      fileName,
      storagePath,
      fileSizeBytes,
      accessStatus: planValidation.accessStatus,
      pdfLimit: planValidation.limit,
      pdfUsed: planValidation.used + 1,
      pdfRemaining:
        planValidation.remaining === null
          ? null
          : Math.max(planValidation.remaining - 1, 0),
      pdfPeriod: planValidation.period,
      conversationId,
    });

    return NextResponse.json(
      {
        id: (insertedPdf as { id: string }).id,
        fileName:
          (insertedPdf as { file_name?: string }).file_name ?? fileName,
        fileSize:
          Number((insertedPdf as { file_size?: number }).file_size ?? fileSizeBytes),
        pdfUsage: {
          limit: planValidation.limit,
          used: planValidation.used + 1,
          remaining:
            planValidation.remaining === null
              ? null
              : Math.max(planValidation.remaining - 1, 0),
          period: planValidation.period,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro em /api/upload-pdf:", error);

    return NextResponse.json(
      { error: "Erro interno ao processar o upload do PDF." },
      { status: 500 }
    );
  }
}