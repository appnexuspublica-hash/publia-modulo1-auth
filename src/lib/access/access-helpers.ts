// src/lib/access/access-helpers.ts

import type { ResolvedUserAccess } from "./resolveUserAccess";

export type ResolvedUiState = {
  isActive: boolean;
  isTrial: boolean;
  isSubscription: boolean;
  isStrategic: boolean;
  isEssential: boolean;
  hasStrategicAccess: boolean;
  hasConsumedStrategicTrial: boolean;
  status: ResolvedUserAccess["effectiveAccessStatus"];
  tier: ResolvedUserAccess["effectiveProductTier"];
};

export function isResolvedActive(resolved: ResolvedUserAccess): boolean {
  return (
    resolved.effectiveAccessStatus === "trial_active" ||
    resolved.effectiveAccessStatus === "subscription_active" ||
    resolved.effectiveAccessStatus === "active"
  );
}

export function isResolvedTrialActive(resolved: ResolvedUserAccess): boolean {
  return resolved.effectiveAccessStatus === "trial_active";
}

export function isResolvedSubscriptionActive(
  resolved: ResolvedUserAccess
): boolean {
  return (
    resolved.effectiveAccessStatus === "subscription_active" ||
    resolved.effectiveAccessStatus === "active"
  );
}

export function isResolvedEssentialSubscriptionActive(
  resolved: ResolvedUserAccess
): boolean {
  return (
    resolved.effectiveProductTier === "essential" &&
    isResolvedSubscriptionActive(resolved)
  );
}

export function hasConsumedStrategicTrial(
  resolved: ResolvedUserAccess
): boolean {
  return resolved.grants.some(
    (grant) => grant.productTier === "strategic" && grant.grantKind === "trial"
  );
}

export function hasResolvedActiveStrategic(
  resolved: ResolvedUserAccess
): boolean {
  return (
    resolved.effectiveProductTier === "strategic" && isResolvedActive(resolved)
  );
}

export function toFrontendAccessStatus(
  resolved: ResolvedUserAccess
): "trial_active" | "trial_expired" | "subscription_active" | "subscription_expired" {
  if (resolved.effectiveAccessStatus === "trial_active") {
    return "trial_active";
  }

  if (
    resolved.effectiveAccessStatus === "subscription_active" ||
    resolved.effectiveAccessStatus === "active"
  ) {
    return "subscription_active";
  }

  if (resolved.effectiveAccessStatus === "subscription_expired") {
    return "subscription_expired";
  }

  if (resolved.effectiveAccessStatus === "trial_expired") {
    return "trial_expired";
  }

  // fallback seguro
  if (resolved.effectiveGrantKind === "subscription") {
    return "subscription_expired";
  }

  return "trial_expired";
}

export function getResolvedUiState(
  resolved: ResolvedUserAccess
): ResolvedUiState {
  const isActive = isResolvedActive(resolved);
  const isTrial = isResolvedTrialActive(resolved);
  const isSubscription = isResolvedSubscriptionActive(resolved);
  const isStrategic = resolved.effectiveProductTier === "strategic";
  const isEssential = resolved.effectiveProductTier === "essential";

  return {
    isActive,
    isTrial,
    isSubscription,
    isStrategic,
    isEssential,
    hasStrategicAccess: hasResolvedActiveStrategic(resolved),
    hasConsumedStrategicTrial: hasConsumedStrategicTrial(resolved),
    status: resolved.effectiveAccessStatus,
    tier: resolved.effectiveProductTier,
  };
}
