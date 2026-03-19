//src/lib/access/cta.ts
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

type AccessCta = {
  href: string;
  label: string;
};

const SUBSCRIBE_URL = "https://nexuspublica.com.br/assinar-publ-ia-agora/";
const RENEW_URL = "https://nexuspublica.com.br/renovar-publ-ia-agora/";

export function getBlockedAccessCta(
  status: AccessCtaStatus,
  reason?: AccessCtaReason
): AccessCta | null {
  if (status === "trial_expired") {
    return {
      href: SUBSCRIBE_URL,
      label: "ASSINAR AGORA",
    };
  }

  if (status === "subscription_expired") {
    return {
      href: RENEW_URL,
      label: "RENOVAR ASSINATURA",
    };
  }

  if (
    status === "trial_active" &&
    (reason === "pdf_limit_reached" || reason === "message_limit_reached")
  ) {
    return {
      href: SUBSCRIBE_URL,
      label: "ASSINAR AGORA",
    };
  }

  return null;
}

export function getSidebarAccessCta(status: AccessCtaStatus): AccessCta | null {
  if (status === "trial_active" || status === "trial_expired") {
    return {
      href: SUBSCRIBE_URL,
      label: "ASSINAR AGORA",
    };
  }

  if (status === "subscription_expired") {
    return {
      href: RENEW_URL,
      label: "RENOVAR ASSINATURA",
    };
  }

  return null;
}