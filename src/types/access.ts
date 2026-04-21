// src/types/access.ts
export type AccessStatus =
  | "trial_active"
  | "trial_expired"
  | "subscription_active"
  | "subscription_expired";

export type ResolvedAccessStatus =
  | "trial_active"
  | "active"
  | "expired"
  | "blocked";

export type ResolvedGrantKind =
  | "trial"
  | "subscription"
  | "upgrade"
  | "fallback"
  | null;

export type ProductTier = "essential" | "strategic" | "governance";

export type BillingCycle = "monthly" | "annual" | "trial" | "none";

export type ScopeType = "individual" | "organization";

export type PdfPeriod = "account" | "month" | "admin" | null;

export type SubscriptionPlan = "monthly" | "annual" | null;

export type BrandConfig = {
  productName: string;
  productLabel: string;
  versionLabel: string;
  vendorLabel: string;
  accentVariant: ProductTier;
};

export type FeatureCapabilities = {
  maxPdfsPerConversation: number;
  maxPdfUploadsPerAccount: number | null;
  maxPdfUploadsPerMonth: number | null;
  responseModes: string[];
  canRenameConversation: boolean;
  canSearchHistory: boolean;
  canFavoriteConversation: boolean;
  canShareConversation: boolean;
  canUseSuggestions: boolean;
  canUseDeliverables: boolean;
  canUseRiskClassification: boolean;
  canUseLocalNorm: boolean;
  canUseLegalBase: boolean;
  canUseTemplates: boolean;
  canUseOrganizationFeatures: boolean;
};

export interface UserAccessSummary {
  user_id: string;
  access_status: AccessStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_message_limit: number | null;
  subscription_plan: string | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  messages_used: number;
  pdf_uploads_used: number;
  input_tokens_used: number;
  output_tokens_used: number;
  total_tokens_used: number;
  product_tier?: ProductTier | null;
}

export type ResolvedAccessSummary = {
  effectiveProductTier: Exclude<ProductTier, "governance"> | null;
  effectiveAccessStatus: ResolvedAccessStatus;
  effectiveGrantKind: ResolvedGrantKind;
  accessSource: "grant" | "snapshot" | "none";
  canUseEssential: boolean;
  canUseStrategic: boolean;
  hasConsumedEssentialTrial: boolean;
  hasConsumedStrategicTrial: boolean;
  canStartEssentialTrial: boolean;
  canStartStrategicTrial: boolean;
  shouldFallbackToEssential: boolean;
  fallbackTarget: "essential" | "strategic" | null;
  label: string;
};

export type FrontendAccessSummary = {
  accessStatus: AccessStatus;
  access_status: AccessStatus;
  blockedMessage: string | null;
  blocked_message?: string | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  subscriptionPlan: SubscriptionPlan;
  messagesUsed: number;
  trialMessageLimit: number | null;
  pdfUsage: {
    limit: number | null;
    used: number;
    remaining: number | null;
    period: PdfPeriod;
  };
  isAdmin?: boolean;
  productTier: ProductTier;
  billingCycle: BillingCycle;
  scopeType: ScopeType;
  capabilities: FeatureCapabilities;
  brand: BrandConfig;
  resolvedAccess?: ResolvedAccessSummary;
};