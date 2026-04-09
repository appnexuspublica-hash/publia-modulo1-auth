// src/app/api/access/me/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildAccessContext,
  evaluateAccessWithAdmin,
  getAccessSummary,
  getPdfUploadsPerMonthForTier,
  getTrialMessageLimitForTier,
  normalizeSubscriptionPlan,
  resolveProductTier,
} from "@/lib/access-control";
import type { AccessStatus, PdfPeriod } from "@/types/access";

type PdfUsageSummary = {
  limit: number | null;
  used: number;
  remaining: number | null;
  period: PdfPeriod;
};

const TRIAL_PDF_LIMIT = 10;

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

async function buildPdfUsage(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  accessStatus: AccessStatus;
  isAdmin: boolean;
  capabilities: {
    maxPdfUploadsPerAccount: number | null;
    maxPdfUploadsPerMonth: number | null;
  };
  productTier: "essential" | "strategic" | "governance";
}): Promise<PdfUsageSummary> {
  const { supabase, userId, accessStatus, isAdmin, capabilities, productTier } = params;

  if (isAdmin) {
    const used = await countUserPdfsAllTime(supabase, userId);

    return {
      limit: null,
      used,
      remaining: null,
      period: "admin",
    };
  }

  if (accessStatus === "trial_active") {
    const used = await countUserPdfsAllTime(supabase, userId);
    const limit = capabilities.maxPdfUploadsPerAccount ?? TRIAL_PDF_LIMIT;

    return {
      limit,
      used,
      remaining: Math.max(limit - used, 0),
      period: "account",
    };
  }

  if (accessStatus === "subscription_active") {
    const used = await countUserPdfsThisMonth(supabase, userId);
    const limit =
      capabilities.maxPdfUploadsPerMonth ?? getPdfUploadsPerMonthForTier(productTier);

    return {
      limit,
      used,
      remaining: limit === null ? null : Math.max(limit - used, 0),
      period: "month",
    };
  }

  return {
    limit: null,
    used: 0,
    remaining: null,
    period: null,
  };
}

function buildBlockedMessage(accessStatus: AccessStatus): string | null {
  if (accessStatus === "trial_expired") {
    return "Seu período de teste expirou. Assine um plano para continuar usando os recursos da IA.";
  }

  if (accessStatus === "subscription_expired") {
    return "Sua assinatura expirou. Renove para voltar a usar os recursos da IA.";
  }

  return null;
}

export async function GET() {
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

    const access = await getAccessSummary(supabase, user.id);

    if (!access) {
      return NextResponse.json(
        { error: "Não foi possível carregar o resumo de acesso." },
        { status: 500 }
      );
    }

    const decision = await evaluateAccessWithAdmin(supabase, access);
    const accessStatus = decision.effectiveStatus as AccessStatus;
    const isAdmin = decision.reason === "admin_override";

    const accessContext = buildAccessContext({
      summary: access,
      effectiveStatus: accessStatus,
      isAdmin,
    });

    const productTier = resolveProductTier(access);

    const pdfUsage = await buildPdfUsage({
      supabase,
      userId: user.id,
      accessStatus,
      isAdmin,
      capabilities: accessContext.capabilities,
      productTier,
    });

    const subscriptionPlan = normalizeSubscriptionPlan(access.subscription_plan);

    const trialMessageLimit = isAdmin
      ? null
      : Math.max(
          typeof access.trial_message_limit === "number" ? access.trial_message_limit : 0,
          getTrialMessageLimitForTier(productTier)
        );

    return NextResponse.json({
      accessStatus,
      access_status: accessStatus,
      blockedMessage: decision.allowed
        ? null
        : decision.message ?? buildBlockedMessage(accessStatus),
      blocked_message: decision.allowed
        ? null
        : decision.message ?? buildBlockedMessage(accessStatus),
      trialEndsAt:
        typeof access.trial_ends_at === "string" ? access.trial_ends_at : null,
      subscriptionEndsAt:
        typeof access.subscription_ends_at === "string"
          ? access.subscription_ends_at
          : null,
      subscriptionPlan,
      messagesUsed:
        typeof access.messages_used === "number" ? access.messages_used : 0,
      trialMessageLimit,
      pdfUsage,
      isAdmin,

      productTier: accessContext.productTier,
      billingCycle: accessContext.billingCycle,
      scopeType: accessContext.scopeType,
      capabilities: accessContext.capabilities,
      brand: accessContext.brand,
    });
  } catch (error) {
    console.error("Erro em /api/access/me:", error);

    return NextResponse.json(
      { error: "Erro interno ao carregar acesso do usuário." },
      { status: 500 }
    );
  }
}