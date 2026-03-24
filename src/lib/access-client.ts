// src/lib/access-client.ts
export type AccessStatus =
  | "trial_active"
  | "trial_expired"
  | "subscription_active"
  | "subscription_expired";

export type PdfPeriod = "account" | "month" | "admin" | null;

export type PdfUsageSummary = {
  limit: number | null;
  used: number;
  remaining: number | null;
  period: PdfPeriod;
};

export type FrontendAccessSummary = {
  accessStatus: AccessStatus;
  access_status: AccessStatus;
  blockedMessage: string | null;
  blocked_message?: string | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  messagesUsed: number;
  trialMessageLimit: number | null;
  pdfUsage: PdfUsageSummary;
  isAdmin?: boolean;
};

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

  const status = data.accessStatus as AccessStatus;

  return {
    accessStatus: status,
    access_status: (data.access_status as AccessStatus) ?? status,
    blockedMessage: data.blockedMessage ?? null,
    blocked_message: data.blocked_message ?? null,
    trialEndsAt: data.trialEndsAt ?? null,
    subscriptionEndsAt: data.subscriptionEndsAt ?? null,
    messagesUsed: typeof data.messagesUsed === "number" ? data.messagesUsed : 0,
    trialMessageLimit:
      typeof data.trialMessageLimit === "number"
        ? data.trialMessageLimit
        : null,
    isAdmin: data.isAdmin === true,
    pdfUsage: {
      limit:
        typeof data?.pdfUsage?.limit === "number" ? data.pdfUsage.limit : null,
      used: typeof data?.pdfUsage?.used === "number" ? data.pdfUsage.used : 0,
      remaining:
        typeof data?.pdfUsage?.remaining === "number"
          ? data.pdfUsage.remaining
          : null,
      period:
        data?.pdfUsage?.period === "account" ||
        data?.pdfUsage?.period === "month" ||
        data?.pdfUsage?.period === "admin"
          ? data.pdfUsage.period
          : null,
    },
  };
}