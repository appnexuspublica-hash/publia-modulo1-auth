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

/**
 * user_access.subscription_plan é um campo legado do snapshot/cache.
 *
 * A fonte da verdade do plano atual está em:
 * - user_access.product_tier
 * - user_access_grants.product_tier
 * - user_access_grants.grant_kind
 *
 * Alguns grants vindos de integrações externas podem ter subscription_plan com
 * valores específicos de produto/checkout que não necessariamente passam no
 * CHECK constraint legado de user_access.subscription_plan.
 *
 * Para evitar quebrar a reconciliação do snapshot, preservamos apenas o valor
 * que já estava salvo em user_access. Se não havia valor anterior, mantemos null.
 */
function resolveSafeSnapshotSubscriptionPlan(
  previousSnapshot: UserAccessRow | null
): string | null {
  return previousSnapshot?.subscription_plan ?? null;
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
    subscriptionPlan: resolveSafeSnapshotSubscriptionPlan(snapshot),
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


type SignupTokenRow = {
  id: string;
  token: string | null;
  created_at: string | null;
  expires_at: string | null;
  used_at: string | null;
  product_tier: string | null;
  grant_kind: string | null;
  trial_days: number | null;
  subscription_plan: string | null;
  source: string | null;
  notes: string | null;
  used_by: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  order_id: string | null;
  subscription_id: string | null;
  raw_payload: Record<string, unknown> | null;
};

type ProfileIdentityRow = {
  cpf_cnpj: string | null;
  email: string | null;
};

function normalizeProductTier(value: unknown): ProductTier | null {
  if (value === "essential" || value === "strategic") {
    return value;
  }

  return null;
}

function normalizeGrantKind(value: unknown): "trial" | "subscription" | "upgrade" {
  if (value === "trial" || value === "subscription" || value === "upgrade") {
    return value;
  }

  return "subscription";
}

function normalizeTokenSubscriptionPlan(value: unknown): string | null {
  if (value === "monthly" || value === "annual") {
    return value;
  }

  return null;
}

function readNestedString(source: unknown, path: string[]): string | null {
  let current: unknown = source;

  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function normalizeDateIso(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function addDaysToIso(baseIso: string, days: number): string {
  const date = new Date(baseIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function resolveTokenStartedAt(token: SignupTokenRow, now: Date): string {
  const rawPayload = token.raw_payload;

  return (
    normalizeDateIso(
      readNestedString(rawPayload, ["Subscription", "start_date"])
    ) ??
    normalizeDateIso(
      readNestedString(rawPayload, ["approved_date"])
    ) ??
    normalizeDateIso(token.created_at) ??
    now.toISOString()
  );
}

function resolveTokenEndsAt(params: {
  token: SignupTokenRow;
  startedAt: string;
  grantKind: "trial" | "subscription" | "upgrade";
}): string | null {
  const { token, startedAt, grantKind } = params;
  const rawPayload = token.raw_payload;

  const subscriptionEnd =
    normalizeDateIso(
      readNestedString(rawPayload, [
        "Subscription",
        "customer_access",
        "access_until",
      ])
    ) ??
    normalizeDateIso(
      readNestedString(rawPayload, ["Subscription", "next_payment"])
    );

  if (subscriptionEnd) {
    return subscriptionEnd;
  }

  if (grantKind === "trial") {
    const trialDays =
      typeof token.trial_days === "number" && token.trial_days > 0
        ? token.trial_days
        : token.product_tier === "strategic"
          ? 7
          : 15;

    return addDaysToIso(startedAt, trialDays);
  }

  return normalizeDateIso(token.expires_at);
}

function sortPendingTokensByPriority(tokens: SignupTokenRow[]): SignupTokenRow[] {
  return [...tokens].sort((a, b) => {
    const aTierScore = a.product_tier === "strategic" ? 200 : 100;
    const bTierScore = b.product_tier === "strategic" ? 200 : 100;

    const aKindScore = a.grant_kind === "subscription" || a.grant_kind === "upgrade" ? 20 : 10;
    const bKindScore = b.grant_kind === "subscription" || b.grant_kind === "upgrade" ? 20 : 10;

    const priorityDiff = bTierScore + bKindScore - (aTierScore + aKindScore);

    if (priorityDiff !== 0) return priorityDiff;

    return (
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime()
    );
  });
}

async function consumePendingSignupTokensForUser(params: {
  supabase: SupabaseClient;
  userId: string;
  now: Date;
}) {
  const { supabase, userId, now } = params;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("cpf_cnpj, email")
    .eq("user_id", userId)
    .maybeSingle<ProfileIdentityRow>();

  if (profileError) {
    console.error(
      "[access/reconcile] Erro ao buscar perfil para consumir token pendente:",
      profileError,
    );
    return;
  }

  const cpf = String(profile?.cpf_cnpj ?? "").replace(/\D/g, "");
  const email = String(profile?.email ?? "").trim().toLowerCase();

  const tokenFilters = [`used_by.eq.${userId}`];

  if (cpf) {
    tokenFilters.push(`cpf_cnpj.eq.${cpf}`);
  }

  if (email) {
    tokenFilters.push(`email.eq.${email}`);
  }

  const { data: tokens, error: tokensError } = await supabase
    .from("signup_tokens")
    .select(
      `
        id,
        token,
        created_at,
        expires_at,
        used_at,
        product_tier,
        grant_kind,
        trial_days,
        subscription_plan,
        source,
        notes,
        used_by,
        cpf_cnpj,
        email,
        order_id,
        subscription_id,
        raw_payload
      `,
    )
    .or(tokenFilters.join(","))
    .returns<SignupTokenRow[]>();

  if (tokensError) {
    console.error(
      "[access/reconcile] Erro ao buscar tokens pendentes do usuário:",
      tokensError,
    );
    return;
  }

  const pendingTokens = sortPendingTokensByPriority(
    (tokens ?? []).filter((token) => {
      const productTier = normalizeProductTier(token.product_tier);
      const grantKind = normalizeGrantKind(token.grant_kind);
      const isUsableKind =
        grantKind === "subscription" || grantKind === "upgrade" || grantKind === "trial";

      return Boolean(productTier && isUsableKind && !token.used_at);
    }),
  );

  for (const token of pendingTokens) {
    const productTier = normalizeProductTier(token.product_tier);

    if (!productTier) continue;

    const grantKind = normalizeGrantKind(token.grant_kind);
    const startedAt = resolveTokenStartedAt(token, now);
    const endsAt = resolveTokenEndsAt({ token, startedAt, grantKind });
    const subscriptionPlan = normalizeTokenSubscriptionPlan(
      token.subscription_plan,
    );

    const { data: existingGrant, error: existingGrantError } = await supabase
      .from("user_access_grants")
      .select("id")
      .eq("user_id", userId)
      .eq("source_token_id", token.id)
      .maybeSingle<{ id: string }>();

    if (existingGrantError) {
      console.error(
        "[access/reconcile] Erro ao verificar grant existente:",
        existingGrantError,
      );
      continue;
    }

    if (!existingGrant) {
      const { error: insertGrantError } = await supabase
        .from("user_access_grants")
        .insert({
          user_id: userId,
          product_tier: productTier,
          grant_kind: grantKind,
          status: "active",
          source: token.source ?? "signup_token",
          source_token_id: token.id,
          subscription_plan: subscriptionPlan,
          started_at: startedAt,
          ends_at: endsAt,
          activated_at: now.toISOString(),
          consumed_at: null,
          canceled_at: null,
          origin_grant_id: null,
          fallback_product_tier: null,
          fallback_reference: null,
          metadata: {
            order_id: token.order_id,
            subscription_id: token.subscription_id,
            token: token.token,
            notes: token.notes,
          },
        });

      if (insertGrantError) {
        console.error(
          "[access/reconcile] Erro ao criar grant a partir do token:",
          insertGrantError,
        );
        continue;
      }
    }

    const { error: tokenUpdateError } = await supabase
      .from("signup_tokens")
      .update({
        used_by: userId,
        used_at: now.toISOString(),
      })
      .eq("id", token.id);

    if (tokenUpdateError) {
      console.error(
        "[access/reconcile] Erro ao marcar token como usado:",
        tokenUpdateError,
      );
    }
  }
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

  await consumePendingSignupTokensForUser({
    supabase,
    userId: normalizedUserId,
    now,
  });

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
