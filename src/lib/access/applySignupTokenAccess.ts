//src/lib/access/applySignupTokenAccess.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCurrentUserAccessByUserId,
  type UserAccessGrantDbRow,
} from "@/lib/access/getCurrentUserAccess";
import { reconcileUserAccessSnapshot } from "@/lib/access/reconcileUserAccessSnapshot";
import type {
  ProductTier,
  AccessStatus,
  GrantKind,
  ResolvedGrant,
  UserAccessRow,
} from "@/lib/access/resolveUserAccess";

type SignupTokenGrantKind = "trial" | "subscription" | "upgrade";

const TRIAL_DURATION_DAYS: Record<ProductTier, number> = {
  essential: 7,
  strategic: 7,
};

type SignupTokenRow = {
  id: string;
  token: string;
  created_at: string | null;
  expires_at: string | null;
  used_at: string | null;
  product_tier: string;
  grant_kind: string;
  trial_days: number | null;
  subscription_plan: string | null;
  source: string | null;
  notes: string | null;
  created_by: string | null;
  used_by: string | null;
};

type UserAccessUpsertRow = {
  user_id: string;
  access_status: AccessStatus;
  product_tier: ProductTier;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_message_limit: number | null;
  subscription_plan: string | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  updated_at: string;
};

type UserAccessGrantInsertRow = {
  user_id: string;
  product_tier: ProductTier;
  grant_kind: GrantKind;
  status: "active";
  source: string;
  source_token_id: string | null;
  subscription_plan: string | null;
  started_at: string;
  ends_at: string | null;
  activated_at: string;
  consumed_at: string | null;
  canceled_at: string | null;
  origin_grant_id: string | null;
  fallback_product_tier: ProductTier | null;
  fallback_reference: string | null;
  metadata: Record<string, unknown>;
};

export type ApplySignupTokenAccessSuccess = {
  ok: true;
  reason: null;
  tokenId: string;
  userId: string;
  appliedProductTier: ProductTier;
  appliedGrantKind: GrantKind;
  snapshot: UserAccessRow | null;
  createdGrant: UserAccessGrantDbRow | null;
};

export type ApplySignupTokenAccessFailureReason =
  | "TOKEN_NOT_FOUND"
  | "TOKEN_ALREADY_USED"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID_PRODUCT_TIER"
  | "TOKEN_INVALID_GRANT_KIND"
  | "ESSENTIAL_TRIAL_ALREADY_CONSUMED"
  | "STRATEGIC_TRIAL_ALREADY_CONSUMED"
  | "ACTIVE_SUBSCRIPTION_CANNOT_START_TRIAL"
  | "USER_ALREADY_HAS_ACTIVE_STRATEGIC"
  | "USER_ALREADY_HAS_ACTIVE_ESSENTIAL"
  | "DATABASE_ERROR";

export type ApplySignupTokenAccessFailure = {
  ok: false;
  reason: ApplySignupTokenAccessFailureReason;
  message: string;
};

export type ApplySignupTokenAccessResult =
  | ApplySignupTokenAccessSuccess
  | ApplySignupTokenAccessFailure;

function isProductTier(value: string | null | undefined): value is ProductTier {
  return value === "essential" || value === "strategic";
}

function isSignupTokenGrantKind(
  value: string | null | undefined,
): value is SignupTokenGrantKind {
  return value === "trial" || value === "subscription" || value === "upgrade";
}

function toIsoDate(date: Date): string {
  return date.toISOString();
}

function addDays(date: Date, days: number): Date {
  const cloned = new Date(date.getTime());
  cloned.setUTCDate(cloned.getUTCDate() + days);
  return cloned;
}

function hasDateExpired(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.getTime() < now.getTime();
}

function resolveTrialDays(
  productTier: ProductTier,
  trialDays: number | null,
): number {
  if (typeof trialDays === "number" && Number.isFinite(trialDays) && trialDays > 0) {
    return trialDays;
  }

  return TRIAL_DURATION_DAYS[productTier];
}

function resolveTrialMessageLimit(productTier: ProductTier): number {
  return productTier === "strategic" ? 100 : 75;
}

function resolveSubscriptionPlan(
  token: SignupTokenRow,
  productTier: ProductTier,
): string {
  if (token.subscription_plan && token.subscription_plan.trim()) {
    return token.subscription_plan.trim();
  }

  return productTier === "strategic" ? "monthly" : "monthly";
}

function resolveSource(token: SignupTokenRow): string {
  if (token.source && token.source.trim()) {
    return token.source.trim();
  }

  if (token.grant_kind === "trial" && token.product_tier === "strategic") {
    return "strategic_trial";
  }

  if (token.grant_kind === "trial" && token.product_tier === "essential") {
    return "essential_trial";
  }

  if (token.grant_kind === "subscription" && token.product_tier === "strategic") {
    return "strategic_subscription";
  }

  if (token.grant_kind === "subscription" && token.product_tier === "essential") {
    return "essential_subscription";
  }

  if (token.grant_kind === "upgrade" && token.product_tier === "strategic") {
    return "essential_upgrade_button";
  }

  return "signup_token";
}

function buildFailure(
  reason: ApplySignupTokenAccessFailureReason,
  message: string,
): ApplySignupTokenAccessFailure {
  return { ok: false, reason, message };
}

function resolveConsumedTrialFlags(grants: ResolvedGrant[]) {
  return {
    hasConsumedEssentialTrial: grants.some(
      (grant) => grant.productTier === "essential" && grant.grantKind === "trial",
    ),
    hasConsumedStrategicTrial: grants.some(
      (grant) => grant.productTier === "strategic" && grant.grantKind === "trial",
    ),
  };
}

function resolveSafeTrialStartedAt(params: {
  previousSnapshot: UserAccessRow | null;
  now: Date;
}): string {
  return params.previousSnapshot?.trial_started_at ?? toIsoDate(params.now);
}

function resolveSafeTrialEndsAt(params: {
  previousSnapshot: UserAccessRow | null;
  trialStartedAt: string;
  productTier: ProductTier;
  explicitTrialDays?: number | null;
}): string {
  const { previousSnapshot, trialStartedAt, productTier, explicitTrialDays } = params;

  if (previousSnapshot?.trial_ends_at) {
    return previousSnapshot.trial_ends_at;
  }

  const startedAt = new Date(trialStartedAt);
  const durationDays = resolveTrialDays(productTier, explicitTrialDays ?? null);

  return toIsoDate(addDays(startedAt, durationDays));
}

function buildUserAccessUpsertRow(params: {
  userId: string;
  productTier: ProductTier;
  grantKind: SignupTokenGrantKind;
  trialDays: number | null;
  subscriptionPlan: string | null;
  previousSnapshot: UserAccessRow | null;
  now: Date;
}): UserAccessUpsertRow {
  const nowIso = toIsoDate(params.now);

  if (params.grantKind === "trial") {
    const endsAt = addDays(params.now, resolveTrialDays(params.productTier, params.trialDays));

    return {
      user_id: params.userId,
      access_status: "trial_active",
      product_tier: params.productTier,
      trial_started_at: nowIso,
      trial_ends_at: toIsoDate(endsAt),
      trial_message_limit: resolveTrialMessageLimit(params.productTier),
      subscription_plan: null,
      subscription_started_at: null,
      subscription_ends_at: null,
      updated_at: nowIso,
    };
  }

  const safeTrialStartedAt = resolveSafeTrialStartedAt({
    previousSnapshot: params.previousSnapshot,
    now: params.now,
  });

  const safeTrialEndsAt = resolveSafeTrialEndsAt({
    previousSnapshot: params.previousSnapshot,
    trialStartedAt: safeTrialStartedAt,
    productTier: params.productTier,
    explicitTrialDays: params.trialDays,
  });

  return {
    user_id: params.userId,
    access_status: "subscription_active",
    product_tier: params.productTier,
    trial_started_at: safeTrialStartedAt,
    trial_ends_at: safeTrialEndsAt,
    trial_message_limit: params.previousSnapshot?.trial_message_limit ?? null,
    subscription_plan: params.subscriptionPlan,
    subscription_started_at: nowIso,
    subscription_ends_at: null,
    updated_at: nowIso,
  };
}

function buildGrantInsertRow(params: {
  userId: string;
  token: SignupTokenRow;
  productTier: ProductTier;
  grantKind: SignupTokenGrantKind;
  fallbackBaseGrant: ResolvedGrant | null;
  now: Date;
}): UserAccessGrantInsertRow {
  const nowIso = toIsoDate(params.now);
  const source = resolveSource(params.token);

  if (params.grantKind === "trial") {
    const trialDays = resolveTrialDays(params.productTier, params.token.trial_days);
    const endsAt = addDays(params.now, trialDays);

    const fallbackProductTier =
      params.productTier === "strategic" && params.fallbackBaseGrant?.productTier === "essential"
        ? "essential"
        : null;

    return {
      user_id: params.userId,
      product_tier: params.productTier,
      grant_kind: "trial",
      status: "active",
      source,
      source_token_id: params.token.id,
      subscription_plan: null,
      started_at: nowIso,
      ends_at: toIsoDate(endsAt),
      activated_at: nowIso,
      consumed_at: null,
      canceled_at: null,
      origin_grant_id: params.fallbackBaseGrant?.id ?? null,
      fallback_product_tier: fallbackProductTier,
      fallback_reference:
        fallbackProductTier === "essential"
          ? "fallback_to_existing_essential_access"
          : null,
      metadata: {
        token_id: params.token.id,
        token_kind: params.token.grant_kind,
        token_product_tier: params.token.product_tier,
        applied_via: "signup_token",
        access_mode: "trial",
        trial_days: trialDays,
        pause_underlying_access: params.productTier === "strategic",
        fallback_origin_grant_id: params.fallbackBaseGrant?.id ?? null,
      },
    };
  }

  const subscriptionPlan = resolveSubscriptionPlan(params.token, params.productTier);

  const fallbackProductTier =
    params.productTier === "strategic" && params.fallbackBaseGrant?.productTier === "essential"
      ? "essential"
      : null;

  return {
    user_id: params.userId,
    product_tier: params.productTier,
    grant_kind: params.grantKind === "subscription" ? "subscription" : "upgrade",
    status: "active",
    source,
    source_token_id: params.token.id,
    subscription_plan: subscriptionPlan,
    started_at: nowIso,
    ends_at: null,
    activated_at: nowIso,
    consumed_at: null,
    canceled_at: null,
    origin_grant_id: params.fallbackBaseGrant?.id ?? null,
    fallback_product_tier: fallbackProductTier,
    fallback_reference:
      fallbackProductTier === "essential"
        ? "fallback_to_existing_essential_access"
        : null,
    metadata: {
      token_id: params.token.id,
      token_kind: params.token.grant_kind,
      token_product_tier: params.token.product_tier,
      applied_via: "signup_token",
      access_mode: params.grantKind === "subscription" ? "subscription" : "upgrade",
      subscription_plan: subscriptionPlan,
      pause_underlying_access: params.productTier === "strategic",
      fallback_origin_grant_id: params.fallbackBaseGrant?.id ?? null,
    },
  };
}

function findBestBaseGrantForFallback(grants: ResolvedGrant[]): ResolvedGrant | null {
  return (
    grants.find(
      (grant) =>
        grant.productTier === "essential" &&
        grant.isCurrentlyActive &&
        (grant.grantKind === "subscription" ||
          grant.grantKind === "upgrade" ||
          grant.grantKind === "trial" ||
          grant.grantKind === "fallback"),
    ) ?? null
  );
}

function hasActivePaidAccess(
  resolved: Awaited<ReturnType<typeof getCurrentUserAccessByUserId>>["resolved"],
): boolean {
  const activeGrant = resolved.activeGrant;

  if (
    activeGrant?.isCurrentlyActive &&
    (activeGrant.grantKind === "subscription" || activeGrant.grantKind === "upgrade")
  ) {
    return true;
  }

  return (
    resolved.effectiveAccessStatus === "subscription_active" &&
    (resolved.effectiveGrantKind === "subscription" ||
      resolved.effectiveGrantKind === "upgrade")
  );
}

function shouldBlockTrialGrant(params: {
  productTier: ProductTier;
  resolved: Awaited<ReturnType<typeof getCurrentUserAccessByUserId>>["resolved"];
}): ApplySignupTokenAccessFailure | null {
  const { productTier, resolved } = params;

  if (hasActivePaidAccess(resolved)) {
    return buildFailure(
      "ACTIVE_SUBSCRIPTION_CANNOT_START_TRIAL",
      "Usuário com assinatura ativa não pode iniciar trial.",
    );
  }

  const { hasConsumedEssentialTrial, hasConsumedStrategicTrial } =
    resolveConsumedTrialFlags(resolved.grants);

  if (productTier === "essential" && hasConsumedEssentialTrial) {
    return buildFailure(
      "ESSENTIAL_TRIAL_ALREADY_CONSUMED",
      "O usuário já consumiu o trial do Essencial.",
    );
  }

  if (productTier === "strategic" && hasConsumedStrategicTrial) {
    return buildFailure(
      "STRATEGIC_TRIAL_ALREADY_CONSUMED",
      "O usuário já consumiu o trial do Estratégico.",
    );
  }

  const activeGrant = resolved.activeGrant;

  if (
    productTier === "strategic" &&
    activeGrant &&
    activeGrant.productTier === "strategic" &&
    activeGrant.isCurrentlyActive
  ) {
    return buildFailure(
      "USER_ALREADY_HAS_ACTIVE_STRATEGIC",
      "O usuário já possui acesso estratégico ativo.",
    );
  }

  if (
    productTier === "essential" &&
    activeGrant &&
    activeGrant.productTier === "essential" &&
    activeGrant.isCurrentlyActive
  ) {
    return buildFailure(
      "USER_ALREADY_HAS_ACTIVE_ESSENTIAL",
      "O usuário já possui acesso essencial ativo.",
    );
  }

  return null;
}

function shouldBlockNonTrialGrant(params: {
  productTier: ProductTier;
  resolved: Awaited<ReturnType<typeof getCurrentUserAccessByUserId>>["resolved"];
}): ApplySignupTokenAccessFailure | null {
  const { productTier, resolved } = params;
  const activeGrant = resolved.activeGrant;

  if (
    productTier === "strategic" &&
    activeGrant &&
    activeGrant.productTier === "strategic" &&
    activeGrant.isCurrentlyActive
  ) {
    return buildFailure(
      "USER_ALREADY_HAS_ACTIVE_STRATEGIC",
      "O usuário já possui acesso estratégico ativo.",
    );
  }

  if (
    productTier === "essential" &&
    activeGrant &&
    activeGrant.productTier === "essential" &&
    activeGrant.isCurrentlyActive
  ) {
    return buildFailure(
      "USER_ALREADY_HAS_ACTIVE_ESSENTIAL",
      "O usuário já possui acesso essencial ativo.",
    );
  }

  return null;
}


type PendingPaidSignupTokenCandidate = {
  id: string;
  token: string;
  created_at: string | null;
  expires_at: string | null;
  used_at: string | null;
  product_tier: string | null;
  grant_kind: string | null;
  subscription_plan: string | null;
  source: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  order_id?: string | null;
  subscription_id?: string | null;
};

export type AutoApplyPendingPaidSignupTokensResult = {
  ok: true;
  userId: string;
  checked: number;
  applied: number;
  tokenIds: string[];
  skipped: Array<{
    tokenId: string;
    reason: ApplySignupTokenAccessFailureReason | "UNKNOWN";
    message: string;
  }>;
};

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeCpfCnpj(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function isPaidSignupTokenCandidate(
  token: PendingPaidSignupTokenCandidate,
): boolean {
  return (
    !token.used_at &&
    (token.grant_kind === "subscription" || token.grant_kind === "upgrade") &&
    (token.product_tier === "essential" || token.product_tier === "strategic")
  );
}

function sortPendingPaidTokensByPriority(
  tokens: PendingPaidSignupTokenCandidate[],
): PendingPaidSignupTokenCandidate[] {
  return [...tokens].sort((a, b) => {
    const aTierScore = a.product_tier === "strategic" ? 2 : 1;
    const bTierScore = b.product_tier === "strategic" ? 2 : 1;

    if (aTierScore !== bTierScore) {
      return bTierScore - aTierScore;
    }

    const aCreated = new Date(a.created_at ?? 0).getTime();
    const bCreated = new Date(b.created_at ?? 0).getTime();

    return bCreated - aCreated;
  });
}

async function getProfileIdentityForPendingPaidTokens(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<{ cpfCnpj: string; email: string }> {
  const { data, error } = await params.supabase
    .from("profiles")
    .select("cpf_cnpj, email")
    .eq("user_id", params.userId)
    .maybeSingle<{ cpf_cnpj: string | null; email: string | null }>();

  if (error) {
    throw new Error(`Erro ao consultar profile para conciliação de tokens: ${error.message}`);
  }

  return {
    cpfCnpj: normalizeCpfCnpj(data?.cpf_cnpj),
    email: normalizeEmail(data?.email),
  };
}

async function findPendingPaidSignupTokensByIdentity(params: {
  supabase: SupabaseClient;
  cpfCnpj: string;
  email: string;
}): Promise<PendingPaidSignupTokenCandidate[]> {
  const allCandidates = new Map<string, PendingPaidSignupTokenCandidate>();

  async function collectByCpfCnpj() {
    if (!params.cpfCnpj) return;

    const { data, error } = await params.supabase
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
          subscription_plan,
          source,
          cpf_cnpj,
          email,
          order_id,
          subscription_id
        `,
      )
      .is("used_at", null)
      .eq("cpf_cnpj", params.cpfCnpj)
      .in("grant_kind", ["subscription", "upgrade"])
      .order("created_at", { ascending: false })
      .returns<PendingPaidSignupTokenCandidate[]>();

    if (error) {
      throw new Error(`Erro ao buscar tokens pagos pendentes por CPF/CNPJ: ${error.message}`);
    }

    for (const token of data ?? []) {
      if (isPaidSignupTokenCandidate(token)) {
        allCandidates.set(token.id, token);
      }
    }
  }

  async function collectByEmail() {
    if (!params.email) return;

    const { data, error } = await params.supabase
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
          subscription_plan,
          source,
          cpf_cnpj,
          email,
          order_id,
          subscription_id
        `,
      )
      .is("used_at", null)
      .eq("email", params.email)
      .in("grant_kind", ["subscription", "upgrade"])
      .order("created_at", { ascending: false })
      .returns<PendingPaidSignupTokenCandidate[]>();

    if (error) {
      throw new Error(`Erro ao buscar tokens pagos pendentes por e-mail: ${error.message}`);
    }

    for (const token of data ?? []) {
      if (isPaidSignupTokenCandidate(token)) {
        allCandidates.set(token.id, token);
      }
    }
  }

  await collectByCpfCnpj();
  await collectByEmail();

  return sortPendingPaidTokensByPriority([...allCandidates.values()]);
}

/**
 * Concilia automaticamente compras pagas criadas antes do cadastro/login.
 *
 * O webhook da Kiwify pode criar um signup_token pago quando ainda não existe
 * profile para o comprador. Depois que o usuário cria conta ou faz login, este
 * helper transforma o token pendente em user_access_grants e atualiza o snapshot.
 *
 * Regra de produto:
 * - assinatura/upgrade pago sempre vence trial;
 * - strategic pago vence essential trial;
 * - token já usado não é reaplicado.
 */
export async function autoApplyPendingPaidSignupTokens(params: {
  supabase: SupabaseClient;
  userId: string;
  now?: Date;
}): Promise<AutoApplyPendingPaidSignupTokensResult> {
  const now = params.now ?? new Date();
  const { cpfCnpj, email } = await getProfileIdentityForPendingPaidTokens({
    supabase: params.supabase,
    userId: params.userId,
  });

  if (!cpfCnpj && !email) {
    return {
      ok: true,
      userId: params.userId,
      checked: 0,
      applied: 0,
      tokenIds: [],
      skipped: [],
    };
  }

  const candidates = await findPendingPaidSignupTokensByIdentity({
    supabase: params.supabase,
    cpfCnpj,
    email,
  });

  const appliedTokenIds: string[] = [];
  const skipped: AutoApplyPendingPaidSignupTokensResult["skipped"] = [];

  for (const candidate of candidates) {
    const result = await applySignupTokenAccess({
      supabase: params.supabase,
      userId: params.userId,
      token: candidate.token,
      now,
    });

    if (result.ok) {
      appliedTokenIds.push(result.tokenId);
      continue;
    }

    skipped.push({
      tokenId: candidate.id,
      reason: result.reason ?? "UNKNOWN",
      message: result.message,
    });
  }

  return {
    ok: true,
    userId: params.userId,
    checked: candidates.length,
    applied: appliedTokenIds.length,
    tokenIds: appliedTokenIds,
    skipped,
  };
}


export async function applySignupTokenAccess(params: {
  supabase: SupabaseClient;
  userId: string;
  token: string;
  now?: Date;
}): Promise<ApplySignupTokenAccessResult> {
  const { supabase, userId, token } = params;
  const now = params.now ?? new Date();

  if (!userId.trim()) {
    return buildFailure("DATABASE_ERROR", "userId é obrigatório.");
  }

  if (!token.trim()) {
    return buildFailure("DATABASE_ERROR", "Token é obrigatório.");
  }

  const tokenResult = await supabase
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
        created_by,
        used_by
      `,
    )
    .eq("token", token.trim())
    .maybeSingle<SignupTokenRow>();

  if (tokenResult.error) {
    return buildFailure(
      "DATABASE_ERROR",
      `Erro ao consultar signup token: ${tokenResult.error.message}`,
    );
  }

  const tokenRow = tokenResult.data;

  if (!tokenRow) {
    return buildFailure("TOKEN_NOT_FOUND", "Token de cadastro não encontrado.");
  }

  if (tokenRow.used_at) {
    return buildFailure("TOKEN_ALREADY_USED", "Este token já foi utilizado.");
  }

  if (hasDateExpired(tokenRow.expires_at, now)) {
    return buildFailure("TOKEN_EXPIRED", "Este token está expirado.");
  }

  if (!isProductTier(tokenRow.product_tier)) {
    return buildFailure(
      "TOKEN_INVALID_PRODUCT_TIER",
      "O token possui product_tier inválido.",
    );
  }

  if (!isSignupTokenGrantKind(tokenRow.grant_kind)) {
    return buildFailure(
      "TOKEN_INVALID_GRANT_KIND",
      "O token possui grant_kind inválido.",
    );
  }

  const currentAccess = await getCurrentUserAccessByUserId(supabase, userId);
  const { resolved, snapshot } = currentAccess;

  const productTier = tokenRow.product_tier;
  const grantKind = tokenRow.grant_kind;

  const conflictFailure =
    grantKind === "trial"
      ? shouldBlockTrialGrant({ productTier, resolved })
      : shouldBlockNonTrialGrant({ productTier, resolved });

  if (conflictFailure) {
    return conflictFailure;
  }

  const fallbackBaseGrant =
    productTier === "strategic" ? findBestBaseGrantForFallback(resolved.grants) : null;

  const grantInsertRow = buildGrantInsertRow({
    userId,
    token: tokenRow,
    productTier,
    grantKind,
    fallbackBaseGrant,
    now,
  });

  const userAccessUpsertRow = buildUserAccessUpsertRow({
    userId,
    productTier,
    grantKind,
    trialDays: tokenRow.trial_days,
    subscriptionPlan:
      grantKind === "trial"
        ? null
        : resolveSubscriptionPlan(tokenRow, productTier),
    previousSnapshot: snapshot,
    now,
  });

  const insertGrantResult = await supabase
    .from("user_access_grants")
    .insert(grantInsertRow)
    .select(
      `
        id,
        user_id,
        product_tier,
        grant_kind,
        status,
        source,
        source_token_id,
        subscription_plan,
        started_at,
        ends_at,
        activated_at,
        consumed_at,
        canceled_at,
        origin_grant_id,
        fallback_product_tier,
        fallback_reference,
        metadata,
        created_at,
        updated_at
      `,
    )
    .maybeSingle<UserAccessGrantDbRow>();

  if (insertGrantResult.error) {
    return buildFailure(
      "DATABASE_ERROR",
      `Erro ao criar grant de acesso: ${insertGrantResult.error.message}`,
    );
  }

  const createdGrant = insertGrantResult.data ?? null;

  const upsertAccessResult = await supabase
    .from("user_access")
    .upsert(userAccessUpsertRow, {
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
      `,
    )
    .maybeSingle<UserAccessRow>();

  if (upsertAccessResult.error) {
    return buildFailure(
      "DATABASE_ERROR",
      `Erro ao atualizar snapshot user_access: ${upsertAccessResult.error.message}`,
    );
  }

  const markTokenResult = await supabase
    .from("signup_tokens")
    .update({
      used_at: toIsoDate(now),
      used_by: userId,
    })
    .eq("id", tokenRow.id)
    .is("used_at", null);

  if (markTokenResult.error) {
    return buildFailure(
      "DATABASE_ERROR",
      `Erro ao marcar token como utilizado: ${markTokenResult.error.message}`,
    );
  }

  let reconciledSnapshot: UserAccessRow | null = upsertAccessResult.data ?? null;

  try {
    const reconcileResult = await reconcileUserAccessSnapshot({
      supabase,
      userId,
      now,
    });

    if (reconcileResult.snapshotAfter) {
      reconciledSnapshot = reconcileResult.snapshotAfter;
    }
  } catch (error) {
    return buildFailure(
      "DATABASE_ERROR",
      `Erro ao reconciliar snapshot user_access: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`,
    );
  }

  return {
    ok: true,
    reason: null,
    tokenId: tokenRow.id,
    userId,
    appliedProductTier: productTier,
    appliedGrantKind:
      grantKind === "trial"
        ? "trial"
        : grantKind === "subscription"
          ? "subscription"
          : "upgrade",
    snapshot: reconciledSnapshot,
    createdGrant,
  };
}
