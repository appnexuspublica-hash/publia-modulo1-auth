// src/lib/access/resolveUserAccess.ts
// FINAL LOGIC FIX – grants são a fonte da verdade; snapshot é apenas cache.
// Compatível com /api/access/me (inclui getResolvedAccessLabel)

export type ProductTier = "essential" | "strategic";

export type AccessStatus =
  | "trial_active"
  | "subscription_active"
  | "trial_expired"
  | "subscription_expired"
  | "active"
  | "expired"
  | "blocked";

export type GrantKind =
  | "trial"
  | "subscription"
  | "upgrade"
  | "fallback";

export type GrantStatus =
  | "active"
  | "expired"
  | "canceled"
  | "consumed"
  | "scheduled";

export type UserAccessRow = {
  id: string;
  user_id: string;
  access_status: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_message_limit: number | null;
  subscription_plan: string | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  product_tier: string | null;
};

export type UserAccessGrantRow = {
  id: string;
  user_id: string;
  product_tier: string;
  grant_kind: string;
  status: string;
  source: string;
  source_token_id: string | null;
  subscription_plan: string | null;
  started_at: string;
  ends_at: string | null;
  activated_at: string;
  consumed_at: string | null;
  canceled_at: string | null;
  origin_grant_id: string | null;
  fallback_product_tier: string | null;
  fallback_reference: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ResolvedGrant = {
  id: string;
  productTier: ProductTier;
  grantKind: GrantKind;
  status: GrantStatus;
  source: string;
  subscriptionPlan: string | null;
  startedAt: string;
  endsAt: string | null;
  activatedAt: string;
  createdAt: string;
  updatedAt: string;
  originGrantId: string | null;
  fallbackProductTier: ProductTier | null;
  isExpiredByDate: boolean;
  isCurrentlyActive: boolean;
};

export type ResolvedUserAccess = {
  effectiveProductTier: ProductTier | null;
  effectiveAccessStatus: AccessStatus;
  effectiveGrantKind: GrantKind | null;

  accessSource: "grant" | "expired_grant" | "fallback" | "snapshot" | "none";

  activeGrant: ResolvedGrant | null;
  fallbackGrant: ResolvedGrant | null;

  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;

  snapshot: UserAccessRow | null;
  grants: ResolvedGrant[];
};

function isProductTier(v: unknown): v is ProductTier {
  return v === "essential" || v === "strategic";
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTime(v: string | null | undefined): number {
  return toDate(v)?.getTime() ?? 0;
}

function hasStarted(v: string | null | undefined, now: Date): boolean {
  const d = toDate(v);
  return d ? d.getTime() <= now.getTime() : false;
}

function hasExpired(v: string | null | undefined, now: Date): boolean {
  const d = toDate(v);
  return d ? d.getTime() < now.getTime() : false;
}

function isSnapshotSubscriptionStatus(
  value: string | null | undefined,
): boolean {
  return value === "subscription_active" || value === "active";
}

function normalizeGrant(
  row: UserAccessGrantRow,
  now: Date,
): ResolvedGrant | null {
  if (!isProductTier(row.product_tier)) return null;

  const isExpiredByDate = hasExpired(row.ends_at, now);
  const started = hasStarted(row.started_at, now);

  const isCurrentlyActive =
    row.status === "active" &&
    started &&
    !isExpiredByDate &&
    !row.canceled_at &&
    !row.consumed_at;

  const grantKind: GrantKind =
    row.grant_kind === "trial" ||
    row.grant_kind === "subscription" ||
    row.grant_kind === "upgrade" ||
    row.grant_kind === "fallback"
      ? row.grant_kind
      : "fallback";

  const grantStatus: GrantStatus =
    row.status === "active" ||
    row.status === "expired" ||
    row.status === "canceled" ||
    row.status === "consumed" ||
    row.status === "scheduled"
      ? row.status
      : "expired";

  return {
    id: row.id,
    productTier: row.product_tier,
    grantKind,
    status: grantStatus,
    source: row.source,
    subscriptionPlan: row.subscription_plan,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    activatedAt: row.activated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    originGrantId: row.origin_grant_id,
    fallbackProductTier: isProductTier(row.fallback_product_tier)
      ? row.fallback_product_tier
      : null,
    isExpiredByDate,
    isCurrentlyActive,
  };
}

function sortByRecency(grants: ResolvedGrant[]): ResolvedGrant[] {
  return [...grants].sort((a, b) => {
    const aKey = Math.max(
      getTime(a.endsAt),
      getTime(a.activatedAt),
      getTime(a.startedAt),
      getTime(a.updatedAt),
      getTime(a.createdAt),
    );

    const bKey = Math.max(
      getTime(b.endsAt),
      getTime(b.activatedAt),
      getTime(b.startedAt),
      getTime(b.updatedAt),
      getTime(b.createdAt),
    );

    return bKey - aKey;
  });
}

function isSubscriptionFamilyGrant(grant: ResolvedGrant): boolean {
  return grant.grantKind === "subscription" || grant.grantKind === "upgrade";
}


function getGrantPriorityScore(grant: ResolvedGrant): number {
  const tierScore =
    grant.productTier === "strategic"
      ? 200
      : grant.productTier === "essential"
        ? 100
        : 0;

  const kindScore =
    isSubscriptionFamilyGrant(grant)
      ? 20
      : grant.grantKind === "trial"
        ? 10
        : 0;

  return tierScore + kindScore;
}

function sortActiveGrantsByPriority(grants: ResolvedGrant[]): ResolvedGrant[] {
  return [...grants].sort((a, b) => {
    const priorityDiff = getGrantPriorityScore(b) - getGrantPriorityScore(a);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const aKey = Math.max(
      getTime(a.endsAt),
      getTime(a.activatedAt),
      getTime(a.startedAt),
      getTime(a.updatedAt),
      getTime(a.createdAt),
    );

    const bKey = Math.max(
      getTime(b.endsAt),
      getTime(b.activatedAt),
      getTime(b.startedAt),
      getTime(b.updatedAt),
      getTime(b.createdAt),
    );

    return bKey - aKey;
  });
}

function isExpiredRelevantGrant(grant: ResolvedGrant, now: Date): boolean {
  if (grant.isCurrentlyActive) return false;
  if (grant.status === "scheduled") return false;
  if (grant.grantKind === "fallback") return false;

  if (grant.status === "expired" || grant.isExpiredByDate) {
    return true;
  }

  if (
    (grant.status === "canceled" || grant.status === "consumed") &&
    !!grant.endsAt &&
    hasExpired(grant.endsAt, now)
  ) {
    return true;
  }

  return false;
}

export function resolveUserAccess(params: {
  snapshot: UserAccessRow | null;
  grants: UserAccessGrantRow[] | null;
  now?: Date;
}): ResolvedUserAccess {
  const now = params.now ?? new Date();

  const normalizedGrants = (params.grants ?? [])
    .map((g) => normalizeGrant(g, now))
    .filter((g): g is ResolvedGrant => Boolean(g));

  const grantsByRecency = sortByRecency(normalizedGrants);

  const activeGrants = grantsByRecency.filter(
    (grant) => grant.isCurrentlyActive,
  );

  const activeGrant =
    sortActiveGrantsByPriority(activeGrants)[0] ?? null;

  if (activeGrant) {
    return {
      effectiveProductTier: activeGrant.productTier,
      effectiveAccessStatus:
        activeGrant.grantKind === "trial"
          ? "trial_active"
          : "subscription_active",
      effectiveGrantKind: activeGrant.grantKind,
      accessSource: "grant",
      activeGrant,
      fallbackGrant: null,
      trialEndsAt: activeGrant.grantKind === "trial" ? activeGrant.endsAt : null,
      subscriptionEndsAt:
        activeGrant.grantKind === "trial" ? null : activeGrant.endsAt,
      snapshot: params.snapshot,
      grants: normalizedGrants,
    };
  }

  const expiredRelevantGrants = grantsByRecency.filter((grant) =>
    isExpiredRelevantGrant(grant, now),
  );

  const lastExpiredSubscriptionGrant =
    expiredRelevantGrants.find(isSubscriptionFamilyGrant) ?? null;

  if (lastExpiredSubscriptionGrant) {
    return {
      effectiveProductTier: lastExpiredSubscriptionGrant.productTier,
      effectiveAccessStatus: "subscription_expired",
      effectiveGrantKind: lastExpiredSubscriptionGrant.grantKind,
      accessSource: "expired_grant",
      activeGrant: null,
      fallbackGrant: null,
      trialEndsAt: null,
      subscriptionEndsAt: lastExpiredSubscriptionGrant.endsAt,
      snapshot: params.snapshot,
      grants: normalizedGrants,
    };
  }

  const lastExpiredTrialGrant =
    expiredRelevantGrants.find((grant) => grant.grantKind === "trial") ?? null;

  if (lastExpiredTrialGrant) {
    return {
      effectiveProductTier: lastExpiredTrialGrant.productTier,
      effectiveAccessStatus: "trial_expired",
      effectiveGrantKind: "trial",
      accessSource: "expired_grant",
      activeGrant: null,
      fallbackGrant: null,
      trialEndsAt: lastExpiredTrialGrant.endsAt,
      subscriptionEndsAt: null,
      snapshot: params.snapshot,
      grants: normalizedGrants,
    };
  }

  const fallbackGrant =
    grantsByRecency.find((grant) => grant.fallbackProductTier) ?? null;

  if (fallbackGrant?.fallbackProductTier) {
    return {
      effectiveProductTier: fallbackGrant.fallbackProductTier,
      effectiveAccessStatus: "blocked",
      effectiveGrantKind: "fallback",
      accessSource: "fallback",
      activeGrant: null,
      fallbackGrant,
      trialEndsAt: null,
      subscriptionEndsAt: null,
      snapshot: params.snapshot,
      grants: normalizedGrants,
    };
  }

  if (params.snapshot && isProductTier(params.snapshot.product_tier)) {
    if (params.snapshot.access_status === "trial_active") {
      return {
        effectiveProductTier: params.snapshot.product_tier,
        effectiveAccessStatus: "trial_active",
        effectiveGrantKind: null,
        accessSource: "snapshot",
        activeGrant: null,
        fallbackGrant: null,
        trialEndsAt: params.snapshot.trial_ends_at,
        subscriptionEndsAt: null,
        snapshot: params.snapshot,
        grants: normalizedGrants,
      };
    }

    if (isSnapshotSubscriptionStatus(params.snapshot.access_status)) {
      return {
        effectiveProductTier: params.snapshot.product_tier,
        effectiveAccessStatus: "subscription_active",
        effectiveGrantKind: null,
        accessSource: "snapshot",
        activeGrant: null,
        fallbackGrant: null,
        trialEndsAt: params.snapshot.trial_ends_at,
        subscriptionEndsAt: params.snapshot.subscription_ends_at,
        snapshot: params.snapshot,
        grants: normalizedGrants,
      };
    }
  }

  return {
    effectiveProductTier: null,
    effectiveAccessStatus: "blocked",
    effectiveGrantKind: null,
    accessSource: "none",
    activeGrant: null,
    fallbackGrant: null,
    trialEndsAt: null,
    subscriptionEndsAt: null,
    snapshot: params.snapshot,
    grants: normalizedGrants,
  };
}

export function getResolvedAccessLabel(
  resolved: ResolvedUserAccess,
): string {
  if (resolved.effectiveAccessStatus === "subscription_expired") {
    return resolved.effectiveProductTier === "strategic"
      ? "Estratégico expirado"
      : resolved.effectiveProductTier === "essential"
        ? "Essencial expirado"
        : "Assinatura expirada";
  }

  if (resolved.effectiveAccessStatus === "trial_expired") {
    return resolved.effectiveProductTier === "strategic"
      ? "Trial Estratégico expirado"
      : resolved.effectiveProductTier === "essential"
        ? "Trial Essencial expirado"
        : "Trial expirado";
  }

  if (resolved.effectiveAccessStatus === "blocked") {
    if (resolved.effectiveProductTier === "strategic") {
      return "Estratégico bloqueado";
    }

    if (resolved.effectiveProductTier === "essential") {
      return "Essencial bloqueado";
    }

    return "Sem acesso";
  }

  if (
    resolved.effectiveProductTier === "strategic" &&
    resolved.effectiveAccessStatus === "trial_active"
  ) {
    return "Trial Estratégico";
  }

  if (
    resolved.effectiveProductTier === "strategic" &&
    (resolved.effectiveAccessStatus === "subscription_active" ||
      resolved.effectiveAccessStatus === "active")
  ) {
    return "Estratégico";
  }

  if (
    resolved.effectiveProductTier === "essential" &&
    resolved.effectiveAccessStatus === "trial_active"
  ) {
    return "Trial Essencial";
  }

  if (
    resolved.effectiveProductTier === "essential" &&
    (resolved.effectiveAccessStatus === "subscription_active" ||
      resolved.effectiveAccessStatus === "active")
  ) {
    return "Essencial";
  }

  return "Sem acesso";
}
