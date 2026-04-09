// src/app/api/upload-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildAccessContext,
  evaluateAccessWithAdmin,
  getAccessSummary,
  getPdfUploadsPerMonthForTier,
} from "@/lib/access-control";
import type { AccessStatus, PdfPeriod, ProductTier } from "@/types/access";

const PDF_UPLOAD_MAX_MB = 30;
const TRIAL_PDF_LIMIT = 10;

const ESSENTIAL_TRIAL_PDFS_PER_CONVERSATION = 1;
const ESSENTIAL_PAID_PDFS_PER_CONVERSATION = 3;

type PdfUploadPlanValidation = {
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  period: PdfPeriod;
  blockedMessage: string | null;
  accessStatus: AccessStatus;
  isAdmin: boolean;
  productTier: ProductTier;
  capabilities: {
    maxPdfsPerConversation: number;
    maxPdfUploadsPerAccount: number | null;
    maxPdfUploadsPerMonth: number | null;
  };
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
      isAdmin: false,
      productTier: "essential",
      capabilities: {
        maxPdfsPerConversation: ESSENTIAL_PAID_PDFS_PER_CONVERSATION,
        maxPdfUploadsPerAccount: TRIAL_PDF_LIMIT,
        maxPdfUploadsPerMonth: getPdfUploadsPerMonthForTier("essential"),
      },
    };
  }

  const decision = await evaluateAccessWithAdmin(supabase, access);
  const accessStatus = decision.effectiveStatus as AccessStatus;
  const isAdmin = decision.reason === "admin_override";
  const accessContext = buildAccessContext({
    summary: access,
    effectiveStatus: accessStatus,
    isAdmin,
  });

  if (isAdmin) {
    const used = await countUserPdfsAllTime(supabase, userId);

    return {
      allowed: true,
      limit: null,
      used,
      remaining: null,
      period: "admin",
      blockedMessage: null,
      accessStatus,
      isAdmin: true,
      productTier: accessContext.productTier,
      capabilities: accessContext.capabilities,
    };
  }

  if (!decision.allowed) {
    return {
      allowed: false,
      limit: null,
      used: 0,
      remaining: 0,
      period: null,
      blockedMessage:
        decision.message ??
        "Seu plano atual não permite enviar novos PDFs.",
      accessStatus,
      isAdmin: false,
      productTier: accessContext.productTier,
      capabilities: accessContext.capabilities,
    };
  }

  if (accessStatus === "trial_active") {
    const used = await countUserPdfsAllTime(supabase, userId);
    const limit =
      accessContext.capabilities.maxPdfUploadsPerAccount ?? TRIAL_PDF_LIMIT;
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
      isAdmin: false,
      productTier: accessContext.productTier,
      capabilities: accessContext.capabilities,
    };
  }

  const used = await countUserPdfsThisMonth(supabase, userId);
  const limit =
    accessContext.capabilities.maxPdfUploadsPerMonth ??
    getPdfUploadsPerMonthForTier(accessContext.productTier);
  const remaining = limit === null ? null : Math.max(limit - used, 0);

  return {
    allowed: limit === null ? true : used < limit,
    limit,
    used,
    remaining,
    period: "month",
    blockedMessage:
      limit !== null && used >= limit
        ? `Você atingiu o limite de ${limit} PDFs neste mês no seu plano atual.`
        : null,
    accessStatus: "subscription_active",
    isAdmin: false,
    productTier: accessContext.productTier,
    capabilities: accessContext.capabilities,
  };
}

async function getConversationPdfCount(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conversationId: string
) {
  const { count, error } = await supabase
    .from("conversation_pdf_links")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversationId);

  if (error) {
    throw new Error(
      `Erro ao contar PDFs vinculados à conversa: ${error.message}`
    );
  }

  return count ?? 0;
}

function getConversationPdfLimit(params: {
  accessStatus: AccessStatus;
  isAdmin: boolean;
  productTier: ProductTier;
  capabilities: {
    maxPdfsPerConversation: number;
  };
}) {
  const { accessStatus, isAdmin, productTier, capabilities } = params;

  if (isAdmin) {
    return capabilities.maxPdfsPerConversation;
  }

  if (productTier === "essential" && accessStatus === "trial_active") {
    return ESSENTIAL_TRIAL_PDFS_PER_CONVERSATION;
  }

  if (
    productTier === "essential" &&
    accessStatus === "subscription_active"
  ) {
    return ESSENTIAL_PAID_PDFS_PER_CONVERSATION;
  }

  return capabilities.maxPdfsPerConversation;
}

async function setConversationActivePdf(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  conversationId: string;
  userId: string;
  pdfFileId: string;
}) {
  const { supabase, conversationId, userId, pdfFileId } = params;

  const { error: deactivateError } = await supabase
    .from("conversation_pdf_links")
    .update({ is_active: false } as never)
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (deactivateError) {
    throw new Error(
      `Erro ao desativar PDFs anteriores da conversa: ${deactivateError.message}`
    );
  }

  const { error: activateError } = await supabase
    .from("conversation_pdf_links")
    .update({ is_active: true } as never)
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .eq("pdf_file_id", pdfFileId);

  if (activateError) {
    throw new Error(
      `Erro ao ativar o PDF atual da conversa: ${activateError.message}`
    );
  }

  const { error: conversationUpdateError } = await supabase
    .from("conversations")
    .update({
      active_pdf_file_id: pdfFileId,
      pdf_enabled: true,
    } as never)
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (conversationUpdateError) {
    throw new Error(
      `Erro ao atualizar conversa com PDF ativo: ${conversationUpdateError.message}`
    );
  }
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
  productTier: ProductTier;
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
    productTier,
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
      product_tier: productTier,
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
          access_status: planValidation.accessStatus,
          isAdmin: planValidation.isAdmin,
          productTier: planValidation.productTier,
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

    const conversationPdfLimit = getConversationPdfLimit({
      accessStatus: planValidation.accessStatus,
      isAdmin: planValidation.isAdmin,
      productTier: planValidation.productTier,
      capabilities: planValidation.capabilities,
    });

    const conversationPdfCount = await getConversationPdfCount(
      supabase,
      conversationId
    );

    if (conversationPdfCount >= conversationPdfLimit) {
      const isEssentialTrial =
        planValidation.productTier === "essential" &&
        planValidation.accessStatus === "trial_active" &&
        !planValidation.isAdmin;

      return NextResponse.json(
        {
          error: isEssentialTrial
            ? `No trial do Publ.IA Essencial, cada conversa pode ter até ${ESSENTIAL_TRIAL_PDFS_PER_CONVERSATION} PDF.`
            : `Esta conversa já atingiu o limite de ${conversationPdfLimit} PDFs vinculados.`,
          accessStatus: planValidation.accessStatus,
          access_status: planValidation.accessStatus,
          isAdmin: planValidation.isAdmin,
          productTier: planValidation.productTier,
          conversationPdfUsage: {
            limit: conversationPdfLimit,
            used: conversationPdfCount,
            remaining: Math.max(conversationPdfLimit - conversationPdfCount, 0),
          },
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

    const insertedPdfId = (insertedPdf as { id: string }).id;

    const { error: linkInsertError } = await supabase
      .from("conversation_pdf_links")
      .insert({
        conversation_id: conversationId,
        pdf_file_id: insertedPdfId,
        user_id: user.id,
        is_active: false,
      } as never);

    if (linkInsertError) {
      console.error(
        "Erro ao salvar conversation_pdf_links:",
        linkInsertError.message
      );

      return NextResponse.json(
        { error: "Não foi possível vincular o PDF à conversa." },
        { status: 500 }
      );
    }

    try {
      await setConversationActivePdf({
        supabase,
        conversationId,
        userId: user.id,
        pdfFileId: insertedPdfId,
      });
    } catch (activePdfError) {
      console.error(activePdfError);

      return NextResponse.json(
        {
          error: "O PDF foi salvo, mas não foi possível defini-lo como ativo.",
        },
        { status: 500 }
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
      productTier: planValidation.productTier,
    });

    return NextResponse.json(
      {
        id: insertedPdfId,
        fileName:
          (insertedPdf as { file_name?: string }).file_name ?? fileName,
        fileSize: Number(
          (insertedPdf as { file_size?: number }).file_size ?? fileSizeBytes
        ),
        isAdmin: planValidation.isAdmin,
        productTier: planValidation.productTier,
        pdfUsage: {
          limit: planValidation.limit,
          used: planValidation.used + 1,
          remaining:
            planValidation.remaining === null
              ? null
              : Math.max(planValidation.remaining - 1, 0),
          period: planValidation.period,
        },
        conversationPdfUsage: {
          limit: conversationPdfLimit,
          used: conversationPdfCount + 1,
          remaining: Math.max(
            conversationPdfLimit - (conversationPdfCount + 1),
            0
          ),
        },
        activePdfFileId: insertedPdfId,
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