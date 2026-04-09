// src/lib/access-client.ts
import type {
  AccessStatus,
  BillingCycle,
  BrandConfig,
  FeatureCapabilities,
  FrontendAccessSummary,
  PdfPeriod,
  ProductTier,
  ScopeType,
  SubscriptionPlan,
} from "@/types/access";

export type { FrontendAccessSummary };

export type PdfUsageSummary = {
  limit: number | null;
  used: number;
  remaining: number | null;
  period: PdfPeriod;
};

function normalizeAccessStatus(value: unknown): AccessStatus {
  if (
    value === "trial_active" ||
    value === "trial_expired" ||
    value === "subscription_active" ||
    value === "subscription_expired"
  ) {
    return value;
  }

  return "trial_expired";
}

function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan {
  if (value === "monthly" || value === "annual") {
    return value;
  }

  return null;
}

function normalizeProductTier(value: unknown): ProductTier {
  if (value === "essential" || value === "strategic" || value === "governance") {
    return value;
  }

  return "essential";
}

function normalizeBillingCycle(value: unknown): BillingCycle {
  if (
    value === "monthly" ||
    value === "annual" ||
    value === "trial" ||
    value === "none"
  ) {
    return value;
  }

  return "none";
}

function normalizeScopeType(value: unknown): ScopeType {
  if (value === "individual" || value === "organization") {
    return value;
  }

  return "individual";
}

function normalizePdfPeriod(value: unknown): PdfPeriod {
  if (value === "account" || value === "month" || value === "admin") {
    return value;
  }

  return null;
}

function normalizeBrand(input: any, productTier: ProductTier): BrandConfig {
  const fallbackMap: Record<ProductTier, BrandConfig> = {
    essential: {
      productName: "Publ.IA Essencial",
      productLabel: "Publ.IA ESSENCIAL",
      versionLabel: "1.7",
      vendorLabel: "Nexus Pública",
      accentVariant: "essential",
    },
    strategic: {
      productName: "Publ.IA Estratégico",
      productLabel: "Publ.IA ESTRATÉGICO",
      versionLabel: "2.0",
      vendorLabel: "Nexus Pública",
      accentVariant: "strategic",
    },
    governance: {
      productName: "Publ.IA Governança",
      productLabel: "Publ.IA GOVERNANÇA",
      versionLabel: "3.0",
      vendorLabel: "Nexus Pública",
      accentVariant: "governance",
    },
  };

  const fallback = fallbackMap[productTier];

  return {
    productName:
      typeof input?.productName === "string" && input.productName.trim()
        ? input.productName
        : fallback.productName,
    productLabel:
      typeof input?.productLabel === "string" && input.productLabel.trim()
        ? input.productLabel
        : fallback.productLabel,
    versionLabel:
      typeof input?.versionLabel === "string" && input.versionLabel.trim()
        ? input.versionLabel
        : fallback.versionLabel,
    vendorLabel:
      typeof input?.vendorLabel === "string" && input.vendorLabel.trim()
        ? input.vendorLabel
        : fallback.vendorLabel,
    accentVariant:
      input?.accentVariant === "essential" ||
      input?.accentVariant === "strategic" ||
      input?.accentVariant === "governance"
        ? input.accentVariant
        : fallback.accentVariant,
  };
}

function normalizeCapabilities(input: any): FeatureCapabilities {
  return {
    maxPdfsPerConversation:
      typeof input?.maxPdfsPerConversation === "number"
        ? input.maxPdfsPerConversation
        : 3,
    maxPdfUploadsPerAccount:
      typeof input?.maxPdfUploadsPerAccount === "number"
        ? input.maxPdfUploadsPerAccount
        : null,
    maxPdfUploadsPerMonth:
      typeof input?.maxPdfUploadsPerMonth === "number"
        ? input.maxPdfUploadsPerMonth
        : null,
    responseModes: Array.isArray(input?.responseModes)
      ? input.responseModes
          .map((item: unknown) => String(item ?? "").trim())
          .filter(Boolean)
      : [],
    canRenameConversation: input?.canRenameConversation === true,
    canSearchHistory: input?.canSearchHistory === true,
    canFavoriteConversation: input?.canFavoriteConversation === true,
    canShareConversation: input?.canShareConversation === true,
    canUseSuggestions: input?.canUseSuggestions === true,
    canUseDeliverables: input?.canUseDeliverables === true,
    canUseRiskClassification: input?.canUseRiskClassification === true,
    canUseLocalNorm: input?.canUseLocalNorm === true,
    canUseLegalBase: input?.canUseLegalBase === true,
    canUseTemplates: input?.canUseTemplates === true,
    canUseOrganizationFeatures: input?.canUseOrganizationFeatures === true,
  };
}

export function canUseAiFeatures(access: FrontendAccessSummary | null): boolean {
  if (!access) return false;

  if (access.isAdmin === true) {
    return true;
  }

  const status = access.accessStatus ?? access.access_status;

  return status === "trial_active" || status === "subscription_active";
}

export function getBlockedAccessMessage(
  access: FrontendAccessSummary | null
): string {
  if (!access) {
    return "Não foi possível validar o acesso da sua conta no momento.";
  }

  if (access.isAdmin === true) {
    return "";
  }

  if (access.blockedMessage) {
    return access.blockedMessage;
  }

  if (access.blocked_message) {
    return access.blocked_message;
  }

  const status = access.accessStatus ?? access.access_status;

  if (status === "trial_expired") {
    return "Seu período de teste expirou. Assine um plano para continuar usando os recursos da IA.";
  }

  if (status === "subscription_expired") {
    return "Sua assinatura expirou. Renove para voltar a usar os recursos da IA.";
  }

  return "Seu acesso está bloqueado no momento.";
}

export async function fetchAccessSummary(): Promise<FrontendAccessSummary> {
  const response = await fetch("/api/access/me", {
    method: "GET",
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao carregar resumo de acesso.");
  }

  const status = normalizeAccessStatus(data.accessStatus);
  const productTier = normalizeProductTier(data.productTier);
  const billingCycle = normalizeBillingCycle(data.billingCycle);
  const scopeType = normalizeScopeType(data.scopeType);

  return {
    accessStatus: status,
    access_status: normalizeAccessStatus(data.access_status ?? status),
    blockedMessage: data.blockedMessage ?? null,
    blocked_message: data.blocked_message ?? null,
    trialEndsAt: data.trialEndsAt ?? null,
    subscriptionEndsAt: data.subscriptionEndsAt ?? null,
    subscriptionPlan: normalizeSubscriptionPlan(data.subscriptionPlan),
    messagesUsed: typeof data.messagesUsed === "number" ? data.messagesUsed : 0,
    trialMessageLimit:
      typeof data.trialMessageLimit === "number" ? data.trialMessageLimit : null,
    isAdmin: data.isAdmin === true,
    productTier,
    billingCycle,
    scopeType,
    capabilities: normalizeCapabilities(data.capabilities),
    brand: normalizeBrand(data.brand, productTier),
    pdfUsage: {
      limit:
        typeof data?.pdfUsage?.limit === "number" ? data.pdfUsage.limit : null,
      used: typeof data?.pdfUsage?.used === "number" ? data.pdfUsage.used : 0,
      remaining:
        typeof data?.pdfUsage?.remaining === "number"
          ? data.pdfUsage.remaining
          : null,
      period: normalizePdfPeriod(data?.pdfUsage?.period),
    },
  };
}