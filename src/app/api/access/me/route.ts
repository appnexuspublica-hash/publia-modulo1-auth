// src/app/api/access/me/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { getCurrentUserAccess } from "@/lib/access/getCurrentUserAccess";
import {
  getResolvedUiState,
  toFrontendAccessStatus,
} from "@/lib/access/access-helpers";
import type { BillingCycle, SubscriptionPlan } from "@/types/access";

type CurrentUserAccessResolved = Awaited<
  ReturnType<typeof getCurrentUserAccess>
>["resolved"];

function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan {
  if (value === "monthly" || value === "annual") {
    return value;
  }

  return null;
}

function getRelevantSubscriptionPlan(
  resolved: CurrentUserAccessResolved
): SubscriptionPlan {
  const activePlan = normalizeSubscriptionPlan(
    resolved.activeGrant?.subscriptionPlan
  );

  if (activePlan) {
    return activePlan;
  }

  const effectiveTier = resolved.effectiveProductTier;

  const grantsByRecency = [...resolved.grants].sort((a, b) => {
    const aTime = new Date(
      a.endsAt ?? a.updatedAt ?? a.createdAt ?? 0
    ).getTime();
    const bTime = new Date(
      b.endsAt ?? b.updatedAt ?? b.createdAt ?? 0
    ).getTime();

    return bTime - aTime;
  });

  const sameTierSubscriptionGrant = grantsByRecency.find((grant) => {
    const plan = normalizeSubscriptionPlan(grant.subscriptionPlan);

    return (
      (grant.grantKind === "subscription" || grant.grantKind === "upgrade") &&
      grant.productTier === effectiveTier &&
      plan !== null
    );
  });

  const sameTierPlan = normalizeSubscriptionPlan(
    sameTierSubscriptionGrant?.subscriptionPlan
  );

  if (sameTierPlan) {
    return sameTierPlan;
  }

  const latestSubscriptionLikeGrant = grantsByRecency.find((grant) => {
    const plan = normalizeSubscriptionPlan(grant.subscriptionPlan);

    return (
      (grant.grantKind === "subscription" || grant.grantKind === "upgrade") &&
      plan !== null
    );
  });

  return normalizeSubscriptionPlan(latestSubscriptionLikeGrant?.subscriptionPlan);
}

function getRelevantBillingCycle(params: {
  accessStatus:
    | "trial_active"
    | "trial_expired"
    | "subscription_active"
    | "subscription_expired";
  subscriptionPlan: SubscriptionPlan;
}): BillingCycle {
  if (params.accessStatus === "trial_active") {
    return "trial";
  }

  if (
    params.accessStatus === "subscription_active" ||
    params.accessStatus === "subscription_expired"
  ) {
    return params.subscriptionPlan ?? "none";
  }

  return "none";
}

function getBlockedMessage(params: {
  isActive: boolean;
  accessStatus:
    | "trial_active"
    | "trial_expired"
    | "subscription_active"
    | "subscription_expired";
}): string | null {
  if (params.isActive) {
    return null;
  }

  if (params.accessStatus === "subscription_expired") {
    return "Sua assinatura expirou. Renove para voltar a usar os recursos da IA.";
  }

  if (params.accessStatus === "trial_expired") {
    return "Seu período de teste expirou. Assine um plano para continuar usando os recursos da IA.";
  }

  return "Seu acesso está bloqueado no momento.";
}

export async function GET() {
  try {
    const cookieStore = cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Variáveis do Supabase não configuradas." },
        { status: 500 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          } catch {}
        },
      },
    });

    const currentAccess = await getCurrentUserAccess(supabase);
    const resolved = currentAccess.resolved;
    const ui = getResolvedUiState(resolved);

    const accessStatus = toFrontendAccessStatus(resolved);
    const productTier = resolved.effectiveProductTier ?? "essential";
    const subscriptionPlan = getRelevantSubscriptionPlan(resolved);
    const billingCycle = getRelevantBillingCycle({
      accessStatus,
      subscriptionPlan,
    });
    const blockedMessage = getBlockedMessage({
      isActive: ui.isActive,
      accessStatus,
    });

    return NextResponse.json({
      resolvedAccess: resolved,
      ui,

      accessStatus,
      access_status: accessStatus,
      productTier,
      billingCycle,
      scopeType: "individual",
      blockedMessage,
      blocked_message: blockedMessage,
      trialEndsAt: resolved.trialEndsAt,
      subscriptionEndsAt: resolved.subscriptionEndsAt,
      subscriptionPlan,
      messagesUsed: 0,
      trialMessageLimit: resolved.snapshot?.trial_message_limit ?? null,
      isAdmin: false,
      capabilities: {
        maxPdfsPerConversation: 3,
        maxPdfUploadsPerAccount: null,
        maxPdfUploadsPerMonth: null,
        responseModes: [],
        canRenameConversation: true,
        canSearchHistory: true,
        canUsePdfChat: true,
        canUseExport: true,
        canUseLegalBase: true,
        canUseTemplates: true,
        canUseOrganizationFeatures: false,
      },
      brand: {
        productName:
          productTier === "strategic"
            ? "Publ.IA Estratégico"
            : "Publ.IA Essencial",
        productLabel:
          productTier === "strategic"
            ? "Publ.IA ESTRATÉGICO"
            : "Publ.IA ESSENCIAL",
        versionLabel: productTier === "strategic" ? "2.0" : "1.7",
        vendorLabel: "Nexus Pública",
        accentVariant: productTier,
      },
      pdfUsage: {
        limit: null,
        used: 0,
        remaining: null,
        period: null,
      },
    });
  } catch (error) {
    console.error("Erro em /api/access/me:", error);

    return NextResponse.json(
      { error: "Erro interno ao carregar acesso do usuário." },
      { status: 500 }
    );
  }
}
