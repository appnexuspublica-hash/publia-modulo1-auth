//src/lib/access-control.ts
import type {
  AccessStatus,
  BillingCycle,
  BrandConfig,
  FeatureCapabilities,
  ProductTier,
  ScopeType,
  SubscriptionPlan,
  UserAccessSummary,
} from "@/types/access";

export type AccessSummary = UserAccessSummary;

export type AccessDecision = {
  allowed: boolean;
  effectiveStatus: AccessStatus;
  reason:
    | null
    | "trial_time_expired"
    | "trial_message_limit_reached"
    | "trial_inactive"
    | "subscription_expired"
    | "admin_override";
  message: string | null;
};

export type ChatResponseMode =
  | "objective"
  | "summary"
  | "step_by_step"
  | "checklist"
  | "document_draft"
  | "manager_guidance";

export type ChatResponseModeResolution = {
  productTier: ProductTier;
  allowedModes: ChatResponseMode[];
  requestedMode: ChatResponseMode | null;
  effectiveMode: ChatResponseMode;
  canUseResponseMode: boolean;
  rejected: boolean;
  rejectionReason:
    | null
    | "response_mode_not_available_for_tier"
    | "response_mode_invalid"
    | "response_mode_not_allowed";
};

const ESSENTIAL_TRIAL_MESSAGE_LIMIT = 75;
const STRATEGIC_TRIAL_MESSAGE_LIMIT = 100;
const GOVERNANCE_TRIAL_MESSAGE_LIMIT = 75;

const TRIAL_PDF_LIMIT = 10;

const ESSENTIAL_SUBSCRIPTION_PDF_LIMIT_MONTH = 25;
const STRATEGIC_SUBSCRIPTION_PDF_LIMIT_MONTH = 40;

const STRATEGIC_CHAT_RESPONSE_MODES = [
  "objective",
  "summary",
  "step_by_step",
  "checklist",
  "document_draft",
  "manager_guidance",
] as const;

const GOVERNANCE_CHAT_RESPONSE_MODES = [
  ...STRATEGIC_CHAT_RESPONSE_MODES,
] as const;

const CHAT_RESPONSE_MODE_SET = new Set<string>([
  ...STRATEGIC_CHAT_RESPONSE_MODES,
  ...GOVERNANCE_CHAT_RESPONSE_MODES,
]);

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeProductTier(value: unknown): ProductTier {
  if (value === "essential" || value === "strategic" || value === "governance") {
    return value;
  }

  return "essential";
}

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan {
  if (value === "monthly" || value === "annual") {
    return value;
  }

  return null;
}

export function resolveProductTier(summary?: Partial<AccessSummary> | null): ProductTier {
  return normalizeProductTier(summary?.product_tier);
}

export function getTrialMessageLimitForTier(productTier: ProductTier): number {
  switch (productTier) {
    case "strategic":
      return STRATEGIC_TRIAL_MESSAGE_LIMIT;
    case "governance":
      return GOVERNANCE_TRIAL_MESSAGE_LIMIT;
    case "essential":
    default:
      return ESSENTIAL_TRIAL_MESSAGE_LIMIT;
  }
}

export function getPdfUploadsPerMonthForTier(productTier: ProductTier): number | null {
  switch (productTier) {
    case "strategic":
      return STRATEGIC_SUBSCRIPTION_PDF_LIMIT_MONTH;
    case "governance":
      return null;
    case "essential":
    default:
      return ESSENTIAL_SUBSCRIPTION_PDF_LIMIT_MONTH;
  }
}

function getEffectiveTrialMessageLimit(summary: AccessSummary): number {
  const productTier = resolveProductTier(summary);
  const tierLimit = getTrialMessageLimitForTier(productTier);
  const storedLimit = Number(summary.trial_message_limit ?? 0);

  if (!Number.isFinite(storedLimit) || storedLimit <= 0) {
    return tierLimit;
  }

  return Math.max(storedLimit, tierLimit);
}

export function deriveBillingCycle(params: {
  accessStatus: AccessStatus;
  subscriptionPlan?: unknown;
  isAdmin?: boolean;
}): BillingCycle {
  const { accessStatus, subscriptionPlan, isAdmin = false } = params;

  if (isAdmin) return "none";

  const normalizedPlan = normalizeSubscriptionPlan(subscriptionPlan);

  if (accessStatus === "trial_active") return "trial";
  if (normalizedPlan === "monthly") return "monthly";
  if (normalizedPlan === "annual") return "annual";

  return "none";
}

export function deriveScopeType(productTier: ProductTier): ScopeType {
  return productTier === "governance" ? "organization" : "individual";
}

export function getBrandConfig(productTier: ProductTier): BrandConfig {
  switch (productTier) {
    case "strategic":
      return {
        productName: "Publ.IA Estratégico",
        productLabel: "Publ.IA ESTRATÉGICO",
        versionLabel: "2.0",
        vendorLabel: "Nexus Pública",
        accentVariant: "strategic",
      };

    case "governance":
      return {
        productName: "Publ.IA Governança",
        productLabel: "Publ.IA GOVERNANÇA",
        versionLabel: "3.0",
        vendorLabel: "Nexus Pública",
        accentVariant: "governance",
      };

    case "essential":
    default:
      return {
        productName: "Publ.IA Essencial",
        productLabel: "Publ.IA ESSENCIAL",
        versionLabel: "1.7",
        vendorLabel: "Nexus Pública",
        accentVariant: "essential",
      };
  }
}

export function getCapabilitiesForTier(productTier: ProductTier): FeatureCapabilities {
  switch (productTier) {
    case "strategic":
      return {
        maxPdfsPerConversation: 5,
        maxPdfUploadsPerAccount: TRIAL_PDF_LIMIT,
        maxPdfUploadsPerMonth: STRATEGIC_SUBSCRIPTION_PDF_LIMIT_MONTH,
        responseModes: [...STRATEGIC_CHAT_RESPONSE_MODES],
        canRenameConversation: true,
        canSearchHistory: true,
        canFavoriteConversation: true,
        canShareConversation: true,
        canUseSuggestions: true,
        canUseDeliverables: true,
        canUseRiskClassification: true,
        canUseLocalNorm: true,
        canUseLegalBase: true,
        canUseTemplates: true,
        canUseOrganizationFeatures: false,
      };

    case "governance":
      return {
        maxPdfsPerConversation: 7,
        maxPdfUploadsPerAccount: null,
        maxPdfUploadsPerMonth: null,
        responseModes: [...GOVERNANCE_CHAT_RESPONSE_MODES],
        canRenameConversation: true,
        canSearchHistory: true,
        canFavoriteConversation: true,
        canShareConversation: true,
        canUseSuggestions: true,
        canUseDeliverables: true,
        canUseRiskClassification: true,
        canUseLocalNorm: true,
        canUseLegalBase: true,
        canUseTemplates: true,
        canUseOrganizationFeatures: true,
      };

    case "essential":
    default:
      return {
        maxPdfsPerConversation: 3,
        maxPdfUploadsPerAccount: TRIAL_PDF_LIMIT,
        maxPdfUploadsPerMonth: ESSENTIAL_SUBSCRIPTION_PDF_LIMIT_MONTH,
        responseModes: [],
        canRenameConversation: false,
        canSearchHistory: false,
        canFavoriteConversation: false,
        canShareConversation: true,
        canUseSuggestions: false,
        canUseDeliverables: false,
        canUseRiskClassification: false,
        canUseLocalNorm: false,
        canUseLegalBase: false,
        canUseTemplates: false,
        canUseOrganizationFeatures: false,
      };
  }
}

export function buildAccessContext(params: {
  summary: AccessSummary;
  effectiveStatus: AccessStatus;
  isAdmin?: boolean;
}) {
  const { summary, effectiveStatus, isAdmin = false } = params;

  const productTier = resolveProductTier(summary);
  const billingCycle = deriveBillingCycle({
    accessStatus: effectiveStatus,
    subscriptionPlan: summary.subscription_plan,
    isAdmin,
  });
  const scopeType = deriveScopeType(productTier);
  const capabilities = getCapabilitiesForTier(productTier);
  const brand = getBrandConfig(productTier);

  return {
    productTier,
    billingCycle,
    scopeType,
    capabilities,
    brand,
  };
}

export function getAllowedChatResponseModesForTier(
  productTier: ProductTier
): ChatResponseMode[] {
  switch (productTier) {
    case "strategic":
      return [...STRATEGIC_CHAT_RESPONSE_MODES];
    case "governance":
      return [...GOVERNANCE_CHAT_RESPONSE_MODES];
    case "essential":
    default:
      return [];
  }
}

export function normalizeRequestedChatResponseMode(
  value: unknown
): ChatResponseMode | null {
  const normalized = String(value ?? "").trim();

  if (!normalized) return null;

  if (!CHAT_RESPONSE_MODE_SET.has(normalized)) {
    return null;
  }

  return normalized as ChatResponseMode;
}

export function resolveChatResponseModeAccess(params: {
  summary: AccessSummary;
  requestedResponseMode: unknown;
}): ChatResponseModeResolution {
  const { summary, requestedResponseMode } = params;

  const productTier = resolveProductTier(summary);
  const allowedModes = getAllowedChatResponseModesForTier(productTier);
  const canUseResponseMode = allowedModes.length > 0;

  const rawRequested = String(requestedResponseMode ?? "").trim();
  const requestedWasProvided = rawRequested.length > 0;

  if (!requestedWasProvided) {
    return {
      productTier,
      allowedModes,
      requestedMode: null,
      effectiveMode: "objective",
      canUseResponseMode,
      rejected: false,
      rejectionReason: null,
    };
  }

  if (!canUseResponseMode) {
    return {
      productTier,
      allowedModes,
      requestedMode: null,
      effectiveMode: "objective",
      canUseResponseMode: false,
      rejected: true,
      rejectionReason: "response_mode_not_available_for_tier",
    };
  }

  const normalizedRequested = normalizeRequestedChatResponseMode(rawRequested);

  if (!normalizedRequested) {
    return {
      productTier,
      allowedModes,
      requestedMode: null,
      effectiveMode: "objective",
      canUseResponseMode,
      rejected: true,
      rejectionReason: "response_mode_invalid",
    };
  }

  if (!allowedModes.includes(normalizedRequested)) {
    return {
      productTier,
      allowedModes,
      requestedMode: normalizedRequested,
      effectiveMode: "objective",
      canUseResponseMode,
      rejected: true,
      rejectionReason: "response_mode_not_allowed",
    };
  }

  return {
    productTier,
    allowedModes,
    requestedMode: normalizedRequested,
    effectiveMode: normalizedRequested,
    canUseResponseMode,
    rejected: false,
    rejectionReason: null,
  };
}

export function evaluateAccess(summary: AccessSummary): AccessDecision {
  const now = new Date();

  const trialEndsAt = toDate(summary.trial_ends_at);
  const subscriptionEndsAt = toDate(summary.subscription_ends_at);

  const messagesUsed = Number(summary.messages_used ?? 0);
  const trialMessageLimit = getEffectiveTrialMessageLimit(summary);

  if (summary.access_status === "subscription_active") {
    if (subscriptionEndsAt && subscriptionEndsAt.getTime() < now.getTime()) {
      return {
        allowed: false,
        effectiveStatus: "subscription_expired",
        reason: "subscription_expired",
        message:
          "Sua assinatura expirou. Renove para continuar utilizando o Publ.IA.",
      };
    }

    return {
      allowed: true,
      effectiveStatus: "subscription_active",
      reason: null,
      message: null,
    };
  }

  if (summary.access_status === "subscription_expired") {
    return {
      allowed: false,
      effectiveStatus: "subscription_expired",
      reason: "subscription_expired",
      message:
        "Sua assinatura expirou. Renove para continuar utilizando o Publ.IA.",
    };
  }

  if (summary.access_status === "trial_active") {
    if (trialEndsAt && trialEndsAt.getTime() < now.getTime()) {
      return {
        allowed: false,
        effectiveStatus: "trial_expired",
        reason: "trial_time_expired",
        message:
          "Seu período de teste terminou. Para continuar utilizando o Publ.IA, ative sua assinatura.",
      };
    }

    if (messagesUsed >= trialMessageLimit) {
      return {
        allowed: false,
        effectiveStatus: "trial_expired",
        reason: "trial_message_limit_reached",
        message:
          "Seu período de teste terminou. Para continuar utilizando o Publ.IA, ative sua assinatura.",
      };
    }

    return {
      allowed: true,
      effectiveStatus: "trial_active",
      reason: null,
      message: null,
    };
  }

  return {
    allowed: false,
    effectiveStatus: "trial_expired",
    reason: "trial_inactive",
    message:
      "Seu período de teste terminou. Para continuar utilizando o Publ.IA, ative sua assinatura.",
  };
}

async function getIsAdmin(client: any, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from("profiles")
    .select("is_admin, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[access-control] erro ao consultar profiles.is_admin/role", error);
    return false;
  }

  const isAdmin = Boolean(data?.is_admin);
  const isAdminRole = String(data?.role ?? "").toLowerCase() === "admin";

  return isAdmin || isAdminRole;
}

export async function evaluateAccessWithAdmin(
  client: any,
  summary: AccessSummary
): Promise<AccessDecision> {
  const isAdmin = await getIsAdmin(client, summary.user_id);

  if (isAdmin) {
    return {
      allowed: true,
      effectiveStatus: "subscription_active",
      reason: "admin_override",
      message: null,
    };
  }

  return evaluateAccess(summary);
}

async function ensureUserAccessRow(client: any, userId: string) {
  const { data: existing, error: existingErr } = await client
    .from("user_access")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) {
    console.error("[access-control] erro ao verificar user_access", existingErr);
    return false;
  }

  if (existing) {
    return true;
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const { error: insertErr } = await client.from("user_access").insert({
    user_id: userId,
    access_status: "trial_active",
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
    trial_message_limit: ESSENTIAL_TRIAL_MESSAGE_LIMIT,
  });

  if (insertErr) {
    console.error(
      "[access-control] erro ao criar user_access automaticamente",
      insertErr
    );
    return false;
  }

  return true;
}

async function getAccessSummaryFromView(
  client: any,
  userId: string
): Promise<AccessSummary | null> {
  const { data, error } = await client
    .from("user_access_summary")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[access-control] erro ao buscar user_access_summary", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    ...(data as AccessSummary),
    product_tier: resolveProductTier(data as Partial<AccessSummary>),
  };
}

async function getAccessSummaryFromTables(
  client: any,
  userId: string
): Promise<AccessSummary | null> {
  const ok = await ensureUserAccessRow(client, userId);
  if (!ok) {
    return null;
  }

  const { data: accessRow, error: accessErr } = await client
    .from("user_access")
    .select(
      "user_id, access_status, trial_started_at, trial_ends_at, trial_message_limit, subscription_plan, subscription_started_at, subscription_ends_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (accessErr) {
    console.error("[access-control] erro ao buscar user_access", accessErr);
    return null;
  }

  if (!accessRow) {
    return null;
  }

  const { data: usageRows, error: usageErr } = await client
    .from("usage_events")
    .select("event_type, input_tokens, output_tokens, total_tokens")
    .eq("user_id", userId);

  if (usageErr) {
    console.error("[access-control] erro ao buscar usage_events", usageErr);
    return null;
  }

  const rows = Array.isArray(usageRows) ? usageRows : [];

  let messagesUsed = 0;
  let pdfUploadsUsed = 0;
  let inputTokensUsed = 0;
  let outputTokensUsed = 0;
  let totalTokensUsed = 0;

  for (const row of rows) {
    const eventType = String(row?.event_type ?? "");

    if (
      eventType === "chat_message" ||
      eventType === "regenerate" ||
      eventType === "pdf_question"
    ) {
      messagesUsed += 1;
    }

    if (eventType === "pdf_upload") {
      pdfUploadsUsed += 1;
    }

    inputTokensUsed += Number(row?.input_tokens ?? 0) || 0;
    outputTokensUsed += Number(row?.output_tokens ?? 0) || 0;
    totalTokensUsed += Number(row?.total_tokens ?? 0) || 0;
  }

  return {
    user_id: accessRow.user_id,
    access_status: accessRow.access_status as AccessStatus,
    trial_started_at: accessRow.trial_started_at,
    trial_ends_at: accessRow.trial_ends_at,
    trial_message_limit: Number(
      accessRow.trial_message_limit ?? ESSENTIAL_TRIAL_MESSAGE_LIMIT
    ),
    subscription_plan: accessRow.subscription_plan ?? null,
    subscription_started_at: accessRow.subscription_started_at ?? null,
    subscription_ends_at: accessRow.subscription_ends_at ?? null,
    messages_used: messagesUsed,
    pdf_uploads_used: pdfUploadsUsed,
    input_tokens_used: inputTokensUsed,
    output_tokens_used: outputTokensUsed,
    total_tokens_used: totalTokensUsed,
    product_tier: "essential",
  };
}

export async function getAccessSummary(
  client: any,
  userId: string
): Promise<AccessSummary | null> {
  const fromView = await getAccessSummaryFromView(client, userId);
  if (fromView) {
    return fromView;
  }

  const fromTables = await getAccessSummaryFromTables(client, userId);
  if (fromTables) {
    return fromTables;
  }

  console.error(
    "[access-control] nenhum resumo de acesso encontrado para user_id:",
    userId
  );
  return null;
}

export async function syncEffectiveAccessStatus(
  client: any,
  summary: AccessSummary
) {
  const isAdmin = await getIsAdmin(client, summary.user_id);

  if (isAdmin) {
    return {
      allowed: true,
      effectiveStatus: "subscription_active" as AccessStatus,
      reason: "admin_override" as const,
      message: null,
    };
  }

  const decision = evaluateAccess(summary);

  if (decision.effectiveStatus !== summary.access_status) {
    const { error } = await client
      .from("user_access")
      .update({ access_status: decision.effectiveStatus })
      .eq("user_id", summary.user_id);

    if (error) {
      console.error("[access-control] erro ao sincronizar access_status", error);
    }
  }

  return decision;
}