// src/lib/access-cta.ts

export type AccessCtaStatus =
  | "trial_active"
  | "trial_expired"
  | "subscription_active"
  | "subscription_expired"
  | null
  | undefined;

export type AccessCtaReason =
  | "pdf_limit_reached"
  | "message_limit_reached"
  | "general_block"
  | null
  | undefined;

export type AccessCtaProductTier =
  | "essential"
  | "strategic"
  | "governance"
  | null
  | undefined;

export type AccessCtaSubscriptionPlan = "monthly" | "annual" | null | undefined;

export type AccessCta = {
  href: string;
  label: string;
};

type AccessLike = {
  accessStatus?: AccessCtaStatus;
  access_status?: AccessCtaStatus;
  productTier?: AccessCtaProductTier;
  subscriptionPlan?: AccessCtaSubscriptionPlan;
  isAdmin?: boolean;
} | null | undefined;

const SUBSCRIBE_URL = "https://nexuspublica.com.br/assinar-publ-ia-agora/";

const RENEW_URLS = {
  strategic: {
    annual: "https://pay.kiwify.com.br/1lHfdbZ",
    monthly: "https://pay.kiwify.com.br/MQoIDeI",
  },
  essential: {
    annual: "https://pay.kiwify.com.br/4sa2UeO",
    monthly: "https://pay.kiwify.com.br/4cgDZxF",
  },
} as const;

function normalizeStatus(value: unknown): AccessCtaStatus {
  if (
    value === "trial_active" ||
    value === "trial_expired" ||
    value === "subscription_active" ||
    value === "subscription_expired"
  ) {
    return value;
  }

  return null;
}

function normalizeProductTier(value: unknown): AccessCtaProductTier {
  if (value === "essential" || value === "strategic" || value === "governance") {
    return value;
  }

  return null;
}

function normalizeSubscriptionPlan(value: unknown): AccessCtaSubscriptionPlan {
  if (value === "monthly" || value === "annual") {
    return value;
  }

  return null;
}

export function getSubscribeNowUrl(): string {
  return SUBSCRIBE_URL;
}

export function getRenewSubscriptionUrl(
  productTier?: AccessCtaProductTier,
  subscriptionPlan?: AccessCtaSubscriptionPlan
): string {
  const normalizedTier = normalizeProductTier(productTier);
  const normalizedPlan = normalizeSubscriptionPlan(subscriptionPlan);

  if (normalizedTier === "strategic") {
    if (normalizedPlan === "annual") {
      return RENEW_URLS.strategic.annual;
    }

    return RENEW_URLS.strategic.monthly;
  }

  if (normalizedTier === "essential") {
    if (normalizedPlan === "annual") {
      return RENEW_URLS.essential.annual;
    }

    return RENEW_URLS.essential.monthly;
  }

  return SUBSCRIBE_URL;
}

export function getBlockedAccessCta(
  status: AccessCtaStatus,
  reason?: AccessCtaReason,
  options?: {
    productTier?: AccessCtaProductTier;
    subscriptionPlan?: AccessCtaSubscriptionPlan;
  }
): AccessCta | null {
  const normalizedStatus = normalizeStatus(status);
  const normalizedTier = normalizeProductTier(options?.productTier);
  const normalizedPlan = normalizeSubscriptionPlan(options?.subscriptionPlan);

  if (normalizedStatus === "trial_expired") {
    return {
      href: SUBSCRIBE_URL,
      label: "ASSINAR AGORA",
    };
  }

  if (normalizedStatus === "subscription_expired") {
    return {
      href: getRenewSubscriptionUrl(normalizedTier, normalizedPlan),
      label: "RENOVAR ASSINATURA",
    };
  }

  if (
    normalizedStatus === "trial_active" &&
    (reason === "pdf_limit_reached" || reason === "message_limit_reached")
  ) {
    return {
      href: SUBSCRIBE_URL,
      label: "ASSINAR AGORA",
    };
  }

  return null;
}

export function getSidebarAccessCta(
  accessOrStatus?: AccessLike | AccessCtaStatus,
  options?: {
    productTier?: AccessCtaProductTier;
    subscriptionPlan?: AccessCtaSubscriptionPlan;
  }
): AccessCta | null {
  if (
    accessOrStatus &&
    typeof accessOrStatus === "object" &&
    accessOrStatus.isAdmin === true
  ) {
    return null;
  }

  const status =
    accessOrStatus && typeof accessOrStatus === "object"
      ? normalizeStatus(accessOrStatus.access_status ?? accessOrStatus.accessStatus)
      : normalizeStatus(accessOrStatus);

  const productTier =
    accessOrStatus && typeof accessOrStatus === "object"
      ? normalizeProductTier(accessOrStatus.productTier)
      : normalizeProductTier(options?.productTier);

  const subscriptionPlan =
    accessOrStatus && typeof accessOrStatus === "object"
      ? normalizeSubscriptionPlan(accessOrStatus.subscriptionPlan)
      : normalizeSubscriptionPlan(options?.subscriptionPlan);

  if (status === "trial_active" || status === "trial_expired") {
    return {
      href: SUBSCRIBE_URL,
      label: "ASSINAR AGORA",
    };
  }

  if (status === "subscription_expired") {
    return {
      href: getRenewSubscriptionUrl(productTier, subscriptionPlan),
      label: "RENOVAR ASSINATURA",
    };
  }

  return null;
}
