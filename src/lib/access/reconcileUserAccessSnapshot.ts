// src/lib/access/reconcileUserAccessSnapshot.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUserAccessByUserId } from "@/lib/access/getCurrentUserAccess";
import type {
  ProductTier,
  UserAccessRow,
} from "@/lib/access/resolveUserAccess";

type SnapshotAccessStatus = "trial_active" | "subscription_active";
type ResolvedActiveAccessStatus =
  | "trial_active"
  | "subscription_active"
  | "active"
  | "trial_expired"
  | "subscription_expired";

type ResolvedFromSource =
  | "grant"
  | "fallback"
  | "snapshot"
  | "none"
  | "expired_grant";

type UserAccessSnapshotUpsertRow = {
  user_id: string;
  access_status: SnapshotAccessStatus;
  product_tier: ProductTier;
  trial_started_at: string;
  trial_ends_at: string;
  trial_message_limit: number;
  subscription_plan: string | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  updated_at: string;
};

export type ReconcileUserAccessSnapshotResult = {
  ok: true;
  userId: string;
  changed: boolean;
  snapshotBefore: UserAccessRow | null;
  snapshotAfter: UserAccessRow | null;
  resolvedFrom: ResolvedFromSource;
};

function toIsoDate(date: Date): string {
  return date.toISOString();
}

function resolveTrialMessageLimit(productTier: ProductTier): number {
  return productTier === "strategic" ? 100 : 75;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function resolveSafeTrialStartedAt(
  previousSnapshot: UserAccessRow | null,
  now: Date
): string {
  return previousSnapshot?.trial_started_at ?? toIsoDate(now);
}

function resolveSafeTrialEndsAt(params: {
  previousSnapshot: UserAccessRow | null;
  trialStartedAt: string;
  productTier: ProductTier;
  fallbackEndsAt?: string | null;
}): string {
  const { previousSnapshot, trialStartedAt, productTier, fallbackEndsAt } = params;

  if (fallbackEndsAt) {
    return fallbackEndsAt;
  }

  if (previousSnapshot?.trial_ends_at) {
    return previousSnapshot.trial_ends_at;
  }

  const startedAt = new Date(trialStartedAt);
  const durationDays = productTier === "strategic" ? 7 : 15;

  return toIsoDate(addDays(startedAt, durationDays));
}

function resolveSafeTrialMessageLimit(
  previousSnapshot: UserAccessRow | null,
  productTier: ProductTier
): number {
  if (typeof previousSnapshot?.trial_message_limit === "number") {
    return previousSnapshot.trial_message_limit;
  }

  return resolveTrialMessageLimit(productTier);
}

function normalizeToSnapshotStatus(
  accessStatus: ResolvedActiveAccessStatus
): SnapshotAccessStatus {
  return accessStatus === "trial_active" ? "trial_active" : "subscription_active";
}

function buildActiveSnapshotRow(params: {
  userId: string;
  now: Date;
  productTier: ProductTier;
  accessStatus: ResolvedActiveAccessStatus;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  subscriptionPlan: string | null;
  subscriptionStartedAt: string | null;
  previousSnapshot: UserAccessRow | null;
}): UserAccessSnapshotUpsertRow {
  const {
    userId,
    now,
    productTier,
    accessStatus,
    trialEndsAt,
    subscriptionEndsAt,
    subscriptionPlan,
    subscriptionStartedAt,
    previousSnapshot,
  } = params;

  const safeTrialStartedAt = resolveSafeTrialStartedAt(previousSnapshot, now);
  const safeTrialEndsAt = resolveSafeTrialEndsAt({
    previousSnapshot,
    trialStartedAt: safeTrialStartedAt,
    productTier,
    fallbackEndsAt: trialEndsAt,
  });
  const safeTrialMessageLimit = resolveSafeTrialMessageLimit(
    previousSnapshot,
    productTier
  );

  if (accessStatus === "trial_active") {
    return {
      user_id: userId,
      access_status: "trial_active",
      product_tier: productTier,
      trial_started_at: safeTrialStartedAt,
      trial_ends_at: safeTrialEndsAt,
      trial_message_limit: safeTrialMessageLimit,
      subscription_plan: null,
      subscription_started_at: null,
      subscription_ends_at: null,
      updated_at: toIsoDate(now),
    };
  }

  return {
    user_id: userId,
    access_status: normalizeToSnapshotStatus(accessStatus),
    product_tier: productTier,
    trial_started_at: safeTrialStartedAt,
    trial_ends_at: safeTrialEndsAt,
    trial_message_limit: safeTrialMessageLimit,
    subscription_plan: subscriptionPlan,
    subscription_started_at:
      subscriptionStartedAt ??
      previousSnapshot?.subscription_started_at ??
      safeTrialStartedAt,
    subscription_ends_at:
      subscriptionEndsAt ?? previousSnapshot?.subscription_ends_at ?? null,
    updated_at: toIsoDate(now),
  };
}

function buildSnapshotRowFromResolved(params: {
  userId: string;
  now: Date;
  currentAccess: Awaited<ReturnType<typeof getCurrentUserAccessByUserId>>;
}): UserAccessSnapshotUpsertRow | null {
  const { userId, now, currentAccess } = params;
  const { resolved, snapshot } = currentAccess;

  if (!resolved.effectiveProductTier) {
    return null;
  }

  if (
    resolved.effectiveAccessStatus === "blocked" ||
    resolved.effectiveAccessStatus === "expired" ||
    resolved.effectiveAccessStatus === "trial_expired" ||
    resolved.effectiveAccessStatus === "subscription_expired"
  ) {
    return null;
  }

  return buildActiveSnapshotRow({
    userId,
    now,
    productTier: resolved.effectiveProductTier,
    accessStatus: resolved.effectiveAccessStatus,
    trialEndsAt: resolved.trialEndsAt,
    subscriptionEndsAt: resolved.subscriptionEndsAt,
    subscriptionPlan:
      resolved.activeGrant?.subscriptionPlan ??
      snapshot?.subscription_plan ??
      null,
    subscriptionStartedAt:
      resolved.activeGrant?.grantKind === "subscription" ||
      resolved.activeGrant?.grantKind === "upgrade"
        ? resolved.activeGrant.startedAt
        : snapshot?.subscription_started_at ?? null,
    previousSnapshot: snapshot,
  });
}

function normalizeComparableSnapshot(row: UserAccessRow | null) {
  if (!row) return null;

  return {
    access_status: row.access_status ?? null,
    product_tier: row.product_tier ?? null,
    trial_started_at: row.trial_started_at ?? null,
    trial_ends_at: row.trial_ends_at ?? null,
    trial_message_limit:
      typeof row.trial_message_limit === "number" ? row.trial_message_limit : null,
    subscription_plan: row.subscription_plan ?? null,
    subscription_started_at: row.subscription_started_at ?? null,
    subscription_ends_at: row.subscription_ends_at ?? null,
  };
}

function normalizeComparableUpsertRow(row: UserAccessSnapshotUpsertRow) {
  return {
    access_status: row.access_status,
    product_tier: row.product_tier,
    trial_started_at: row.trial_started_at,
    trial_ends_at: row.trial_ends_at,
    trial_message_limit: row.trial_message_limit,
    subscription_plan: row.subscription_plan,
    subscription_started_at: row.subscription_started_at,
    subscription_ends_at: row.subscription_ends_at,
  };
}

function areSnapshotsEquivalent(
  currentSnapshot: UserAccessRow | null,
  nextSnapshot: UserAccessSnapshotUpsertRow
): boolean {
  const current = normalizeComparableSnapshot(currentSnapshot);
  const next = normalizeComparableUpsertRow(nextSnapshot);

  if (!current) return false;

  return (
    current.access_status === next.access_status &&
    current.product_tier === next.product_tier &&
    current.trial_started_at === next.trial_started_at &&
    current.trial_ends_at === next.trial_ends_at &&
    current.trial_message_limit === next.trial_message_limit &&
    current.subscription_plan === next.subscription_plan &&
    current.subscription_started_at === next.subscription_started_at &&
    current.subscription_ends_at === next.subscription_ends_at
  );
}

export async function reconcileUserAccessSnapshot(params: {
  supabase: SupabaseClient;
  userId: string;
  now?: Date;
}): Promise<ReconcileUserAccessSnapshotResult> {
  const { supabase } = params;
  const now = params.now ?? new Date();

  const normalizedUserId =
    typeof params.userId === "string" ? params.userId.trim() : "";

  if (!normalizedUserId) {
    throw new Error(
      "userId é obrigatório para reconciliar o snapshot de acesso."
    );
  }

  const currentAccess = await getCurrentUserAccessByUserId(
    supabase,
    normalizedUserId
  );
  const snapshotBefore = currentAccess.snapshot;

  const nextSnapshotRow = buildSnapshotRowFromResolved({
    userId: normalizedUserId,
    now,
    currentAccess,
  });

  if (!nextSnapshotRow) {
    return {
      ok: true,
      userId: normalizedUserId,
      changed: false,
      snapshotBefore,
      snapshotAfter: snapshotBefore,
      resolvedFrom: currentAccess.resolved.accessSource,
    };
  }

  if (areSnapshotsEquivalent(snapshotBefore, nextSnapshotRow)) {
    return {
      ok: true,
      userId: normalizedUserId,
      changed: false,
      snapshotBefore,
      snapshotAfter: snapshotBefore,
      resolvedFrom: currentAccess.resolved.accessSource,
    };
  }

  const upsertResult = await supabase
    .from("user_access")
    .upsert(nextSnapshotRow, {
      onConflict: "user_id",
    })
    .select(
      `
        id,
        user_id,
        access_status,
        trial_started_at,
        trial_ends_at,
        trial_message_limit,
        subscription_plan,
        subscription_started_at,
        subscription_ends_at,
        created_at,
        updated_at,
        product_tier
      `
    )
    .maybeSingle<UserAccessRow>();

  if (upsertResult.error) {
    throw new Error(
      `Erro ao reconciliar snapshot user_access: ${upsertResult.error.message}`
    );
  }

  return {
    ok: true,
    userId: normalizedUserId,
    changed: true,
    snapshotBefore,
    snapshotAfter: upsertResult.data ?? null,
    resolvedFrom: currentAccess.resolved.accessSource,
  };
}
