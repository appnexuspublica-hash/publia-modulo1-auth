// src/app/api/kiwify/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAccessByUserId } from "@/lib/access/getCurrentUserAccess";
import type { ProductTier } from "@/lib/access/resolveUserAccess";

type SubscriptionPlan = "monthly" | "annual";

type SnapshotAccessStatus =
  | "trial_active"
  | "trial_expired"
  | "subscription_active"
  | "subscription_expired";

type JsonRecord = Record<string, unknown>;

type ExistingUserAccess = {
  user_id: string;
  access_status: string | null;
  product_tier: string | null;
  subscription_plan: string | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
};

type ActiveBaseGrant = {
  id: string;
  product_tier: ProductTier;
  grant_kind: string;
};

type LogProcessingStatus = "received" | "ignored" | "processed" | "error";

function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedValue(source: unknown, path: string[]): unknown {
  let current: unknown = source;

  for (const key of path) {
    if (!isRecord(current)) {
      return null;
    }

    current = current[key];
  }

  return current ?? null;
}

function getFirstAvailable(source: unknown, paths: string[][]): unknown {
  for (const path of paths) {
    const value = getNestedValue(source, path);

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function parseIsoDate(value: unknown): string | null {
  if (!value) return null;

  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function addMonths(baseIso: string, months: number): string {
  const date = new Date(baseIso);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function addYears(baseIso: string, years: number): string {
  const date = new Date(baseIso);
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString();
}

function getOrderRoot(payload: unknown): unknown {
  return getFirstAvailable(payload, [["order"]]) ?? payload;
}

function getEventType(payload: unknown): string {
  const root = getOrderRoot(payload);

  const raw = getFirstAvailable(root, [
    ["webhook_event_type"],
    ["event"],
    ["type"],
    ["evento"],
  ]);

  return String(raw ?? "").trim().toLowerCase();
}

function getOrderStatus(payload: unknown): string {
  const root = getOrderRoot(payload);

  const raw = getFirstAvailable(root, [
    ["order_status"],
    ["status_do_pedido"],
    ["status"],
  ]);

  return String(raw ?? "").trim().toLowerCase();
}

function getApprovedAt(payload: unknown): string | null {
  const root = getOrderRoot(payload);

  const raw = getFirstAvailable(root, [
    ["approved_date"],
    ["data_aprovada"],
    ["approved_at"],
    ["order_approved_at"],
  ]);

  return parseIsoDate(raw);
}

function getCustomerCpfCnpj(payload: unknown): string {
  const root = getOrderRoot(payload);

  const raw = getFirstAvailable(root, [
    ["Customer", "CPF"],
    ["Customer", "cpf"],
    ["Customer", "cnpj"],
    ["customer", "CPF"],
    ["customer", "cpf"],
    ["customer", "cnpj"],
    ["cliente", "CPF"],
    ["cliente", "cpf"],
    ["cliente", "cnpj"],
  ]);

  return onlyDigits(raw);
}

function getSubscriptionStatus(payload: unknown): string {
  const root = getOrderRoot(payload);

  const raw = getFirstAvailable(root, [
    ["Subscription", "status"],
    ["subscription", "status"],
    ["Subscrição", "status"],
    ["Subscricao", "status"],
  ]);

  return String(raw ?? "").trim().toLowerCase();
}

function getSubscriptionFrequency(payload: unknown): string {
  const root = getOrderRoot(payload);

  const raw = getFirstAvailable(root, [
    ["Subscription", "plan", "frequency"],
    ["subscription", "plan", "frequency"],
    ["plano", "frequência"],
    ["plano", "frequencia"],
    ["plan", "frequency"],
  ]);

  return String(raw ?? "").trim().toLowerCase();
}

function getSubscriptionStart(payload: unknown): string | null {
  const root = getOrderRoot(payload);

  const raw = getFirstAvailable(root, [
    ["Subscription", "start_date"],
    ["subscription", "start_date"],
    ["Subscrição", "data_de_início"],
    ["Subscrição", "data_de_inicio"],
    ["Subscricao", "data_de_inicio"],
  ]);

  return parseIsoDate(raw);
}

function getSubscriptionNextPayment(payload: unknown): string | null {
  const root = getOrderRoot(payload);

  const raw = getFirstAvailable(root, [
    ["Subscription", "next_payment"],
    ["subscription", "next_payment"],
    ["Subscrição", "próximo_pagamento"],
    ["Subscrição", "proximo_pagamento"],
    ["Subscricao", "proximo_pagamento"],
  ]);

  return parseIsoDate(raw);
}

function getSubscriptionId(payload: unknown): string | null {
  const root = getOrderRoot(payload);

  const raw = getFirstAvailable(root, [
    ["Subscription", "id"],
    ["subscription", "id"],
    ["subscription_id"],
    ["Subscrição", "id"],
    ["Subscricao", "id"],
  ]);

  const value = String(raw ?? "").trim();
  return value || null;
}

function getOrderId(payload: unknown): string | null {
  const root = getOrderRoot(payload);

  const raw = getFirstAvailable(root, [
    ["order_id"],
    ["id"],
    ["ID do pedido"],
    ["orderId"],
  ]);

  const value = String(raw ?? "").trim();
  return value || null;
}

function getProductDescriptor(payload: unknown): string {
  const root = getOrderRoot(payload);

  const parts = [
    getFirstAvailable(root, [
      ["Product", "name"],
      ["Product", "product_name"],
      ["product", "name"],
      ["product", "product_name"],
      ["produto", "nome"],
      ["product_name"],
      ["offer_name"],
      ["plan", "name"],
      ["Subscription", "plan", "name"],
      ["subscription", "plan", "name"],
    ]),
    getFirstAvailable(root, [
      ["Product", "title"],
      ["product", "title"],
      ["produto", "titulo"],
      ["title"],
    ]),
    getFirstAvailable(root, [
      ["Product", "code"],
      ["Product", "product_id"],
      ["product", "code"],
      ["product", "product_id"],
      ["produto", "codigo"],
      ["offer_code"],
      ["plan_code"],
    ]),
  ];

  return parts
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" | ");
}

function mapProductTier(
  payload: unknown,
  existingAccess: ExistingUserAccess | null
): ProductTier {
  const descriptor = getProductDescriptor(payload);

  if (
    descriptor.includes("estratégico") ||
    descriptor.includes("estrategico") ||
    descriptor.includes("strategic")
  ) {
    return "strategic";
  }

  if (descriptor.includes("essencial") || descriptor.includes("essential")) {
    return "essential";
  }

  if (existingAccess?.product_tier === "strategic") {
    return "strategic";
  }

  return "essential";
}

function mapPlan(payload: unknown): SubscriptionPlan | null {
  const frequency = getSubscriptionFrequency(payload);

  if (
    frequency === "monthly" ||
    frequency === "month" ||
    frequency === "mensal"
  ) {
    return "monthly";
  }

  if (
    frequency === "annual" ||
    frequency === "yearly" ||
    frequency === "year" ||
    frequency === "anual"
  ) {
    return "annual";
  }

  return null;
}

function isApprovalEvent(payload: unknown): boolean {
  const eventType = getEventType(payload);
  const orderStatus = getOrderStatus(payload);
  const approvedAt = getApprovedAt(payload);
  const subscriptionStatus = getSubscriptionStatus(payload);

  if (approvedAt) {
    return true;
  }

  if (
    eventType.includes("approved") ||
    eventType.includes("paid") ||
    eventType.includes("renewed") ||
    eventType === "compra_aprovada" ||
    eventType === "order_approved"
  ) {
    return true;
  }

  if (orderStatus === "paid" || orderStatus === "approved") {
    return true;
  }

  if (subscriptionStatus === "active" && eventType.includes("subscription")) {
    return true;
  }

  return false;
}

function isRenewalEvent(payload: unknown): boolean {
  const eventType = getEventType(payload);

  return (
    eventType.includes("renew") ||
    eventType.includes("recurring") ||
    eventType.includes("subscription_renewed") ||
    eventType.includes("invoice_paid")
  );
}

function isPendingPaymentEvent(payload: unknown): boolean {
  const eventType = getEventType(payload);
  const orderStatus = getOrderStatus(payload);

  if (
    eventType === "pix_created" ||
    eventType === "boleto_created" ||
    eventType === "waiting_payment"
  ) {
    return true;
  }

  if (
    orderStatus === "waiting_payment" ||
    orderStatus === "pending" ||
    orderStatus === "processing"
  ) {
    return true;
  }

  return false;
}

function isNegativeEvent(payload: unknown): boolean {
  const eventType = getEventType(payload);
  const orderStatus = getOrderStatus(payload);
  const subscriptionStatus = getSubscriptionStatus(payload);

  if (
    eventType.includes("canceled") ||
    eventType.includes("cancelled") ||
    eventType.includes("late") ||
    eventType.includes("delinquent") ||
    eventType.includes("refused") ||
    eventType.includes("chargeback") ||
    eventType.includes("expired") ||
    eventType.includes("unpaid") ||
    eventType.includes("overdue")
  ) {
    return true;
  }

  if (
    orderStatus === "refused" ||
    orderStatus === "canceled" ||
    orderStatus === "cancelled" ||
    orderStatus === "expired" ||
    orderStatus === "unpaid" ||
    orderStatus === "overdue"
  ) {
    return true;
  }

  if (
    subscriptionStatus === "canceled" ||
    subscriptionStatus === "cancelled" ||
    subscriptionStatus === "late" ||
    subscriptionStatus === "expired" ||
    subscriptionStatus === "unpaid" ||
    subscriptionStatus === "overdue"
  ) {
    return true;
  }

  return false;
}

function getLaterDate(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;

  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function getEarlierDate(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;

  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function resolveDates(
  payload: unknown,
  plan: SubscriptionPlan,
  existingAccess: ExistingUserAccess | null
): {
  startedAt: string;
  endsAt: string;
} {
  const approvedAt = getApprovedAt(payload);
  const subscriptionStart = getSubscriptionStart(payload);
  const nextPayment = getSubscriptionNextPayment(payload);

  const baseStartedAt =
    approvedAt ??
    subscriptionStart ??
    existingAccess?.subscription_started_at ??
    new Date().toISOString();

  const startedAt =
    getEarlierDate(
      existingAccess?.subscription_started_at ?? null,
      baseStartedAt
    ) ?? baseStartedAt;

  let calculatedEndsAt: string;

  if (nextPayment) {
    calculatedEndsAt = nextPayment;
  } else {
    const extensionBase =
      getLaterDate(existingAccess?.subscription_ends_at ?? null, baseStartedAt) ??
      baseStartedAt;

    calculatedEndsAt =
      plan === "monthly"
        ? addMonths(extensionBase, 1)
        : addYears(extensionBase, 1);
  }

  const endsAt =
    getLaterDate(existingAccess?.subscription_ends_at ?? null, calculatedEndsAt) ??
    calculatedEndsAt;

  return {
    startedAt,
    endsAt,
  };
}

function getActivationAction(
  payload: unknown,
  existingAccess: ExistingUserAccess | null
): "subscription_activated" | "subscription_renewed" {
  if (isRenewalEvent(payload)) {
    return "subscription_renewed";
  }

  if (
    existingAccess?.access_status === "subscription_active" ||
    existingAccess?.access_status === "active"
  ) {
    return "subscription_renewed";
  }

  return "subscription_activated";
}

function getSnapshotTrialDates(params: {
  existingAccess: ExistingUserAccess | null;
  fallbackStartedAt: string | null;
  fallbackEndsAt: string | null;
  nowIso: string;
}): {
  trialStartedAt: string;
  trialEndsAt: string;
} {
  const trialStartedAt =
    params.existingAccess?.trial_started_at ??
    params.fallbackStartedAt ??
    params.nowIso;

  const trialEndsAt =
    params.existingAccess?.trial_ends_at ??
    params.fallbackEndsAt ??
    trialStartedAt;

  return {
    trialStartedAt,
    trialEndsAt,
  };
}

function getExpiredSnapshotStatus(
  existingAccess: ExistingUserAccess | null
): SnapshotAccessStatus {
  const hasSubscriptionHistory =
    !!existingAccess?.subscription_started_at ||
    !!existingAccess?.subscription_ends_at ||
    !!existingAccess?.subscription_plan ||
    existingAccess?.access_status === "subscription_active" ||
    existingAccess?.access_status === "subscription_expired";

  return hasSubscriptionHistory ? "subscription_expired" : "trial_expired";
}

async function findActiveBaseGrantForFallback(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
): Promise<ActiveBaseGrant | null> {
  const currentAccess = await getCurrentUserAccessByUserId(supabase, userId);

  const fallbackGrant =
    currentAccess.grants.find(
      (grant) =>
        grant.product_tier === "essential" &&
        grant.status === "active" &&
        (grant.grant_kind === "subscription" || grant.grant_kind === "trial")
    ) ?? null;

  if (!fallbackGrant) {
    return null;
  }

  return {
    id: fallbackGrant.id,
    product_tier: "essential",
    grant_kind: fallbackGrant.grant_kind,
  };
}

async function upsertSubscriptionGrant(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  productTier: ProductTier;
  subscriptionPlan: SubscriptionPlan;
  startedAt: string;
  endsAt: string;
  payload: unknown;
  sourceLabel: string;
  sourceTokenId?: string | null;
}): Promise<void> {
  const {
    supabase,
    userId,
    productTier,
    subscriptionPlan,
    startedAt,
    endsAt,
    payload,
    sourceLabel,
  } = params;

  const fallbackBaseGrant =
    productTier === "strategic"
      ? await findActiveBaseGrantForFallback(supabase, userId)
      : null;

  const { data: existingGrant, error: existingGrantError } = await supabase
    .from("user_access_grants")
    .select("id")
    .eq("user_id", userId)
    .eq("product_tier", productTier)
    .eq("grant_kind", "subscription")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingGrantError) {
    throw new Error(
      `Erro ao buscar grant de assinatura existente: ${existingGrantError.message}`
    );
  }

  const nowIso = new Date().toISOString();

  if (existingGrant?.id) {
    const { error: updateError } = await supabase
      .from("user_access_grants")
      .update({
        status: "active",
        source: sourceLabel,
        subscription_plan: subscriptionPlan,
        started_at: startedAt,
        ends_at: endsAt,
        activated_at: startedAt,
        canceled_at: null,
        consumed_at: null,
        fallback_product_tier:
          productTier === "strategic" && fallbackBaseGrant?.product_tier === "essential"
            ? "essential"
            : null,
        fallback_reference:
          productTier === "strategic" && fallbackBaseGrant?.product_tier === "essential"
            ? "fallback_to_existing_essential_access"
            : null,
        origin_grant_id: fallbackBaseGrant?.id ?? null,
        metadata: {
          provider: "kiwify",
          last_payload: payload,
          updated_from_webhook: true,
        },
        updated_at: nowIso,
      })
      .eq("id", existingGrant.id);

    if (updateError) {
      throw new Error(
        `Erro ao atualizar grant de assinatura: ${updateError.message}`
      );
    }

    return;
  }

  const { error: insertError } = await supabase.from("user_access_grants").insert({
    user_id: userId,
    product_tier: productTier,
    grant_kind: "subscription",
    status: "active",
    source: sourceLabel,
    source_token_id: null,
    subscription_plan: subscriptionPlan,
    started_at: startedAt,
    ends_at: endsAt,
    activated_at: startedAt,
    consumed_at: null,
    canceled_at: null,
    origin_grant_id: fallbackBaseGrant?.id ?? null,
    fallback_product_tier:
      productTier === "strategic" && fallbackBaseGrant?.product_tier === "essential"
        ? "essential"
        : null,
    fallback_reference:
      productTier === "strategic" && fallbackBaseGrant?.product_tier === "essential"
        ? "fallback_to_existing_essential_access"
        : null,
    metadata: {
      provider: "kiwify",
      created_from_webhook: true,
      payload,
    },
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (insertError) {
    throw new Error(`Erro ao criar grant de assinatura: ${insertError.message}`);
  }
}

async function expireSubscriptionGrants(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  productTier: ProductTier;
  payload: unknown;
  reason: string;
}): Promise<void> {
  const { supabase, userId, productTier, payload, reason } = params;
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("user_access_grants")
    .update({
      status: "expired",
      canceled_at: nowIso,
      metadata: {
        provider: "kiwify",
        expired_from_webhook: true,
        reason,
        payload,
      },
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .eq("product_tier", productTier)
    .eq("grant_kind", "subscription")
    .eq("status", "active");

  if (error) {
    throw new Error(`Erro ao expirar grants de assinatura: ${error.message}`);
  }
}

async function syncUserAccessSnapshot(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  fallbackProductTier?: ProductTier;
  existingAccess: ExistingUserAccess | null;
}): Promise<void> {
  const {
    supabase,
    userId,
    fallbackProductTier = "essential",
    existingAccess,
  } = params;
  const nowIso = new Date().toISOString();

  const currentAccess = await getCurrentUserAccessByUserId(supabase, userId);
  const { resolved } = currentAccess;

  const defaultProductTier =
    resolved.effectiveProductTier ?? fallbackProductTier ?? "essential";

  if (resolved.effectiveAccessStatus === "trial_active" && resolved.activeGrant) {
    const { error } = await supabase.from("user_access").upsert(
      {
        user_id: userId,
        access_status: "trial_active" as SnapshotAccessStatus,
        product_tier: resolved.effectiveProductTier ?? defaultProductTier,
        trial_started_at: resolved.activeGrant.startedAt,
        trial_ends_at: resolved.activeGrant.endsAt,
        subscription_plan: null,
        subscription_started_at: existingAccess?.subscription_started_at ?? null,
        subscription_ends_at: existingAccess?.subscription_ends_at ?? null,
        updated_at: nowIso,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      throw new Error(`Erro ao sincronizar snapshot trial: ${error.message}`);
    }

    return;
  }

  if (resolved.effectiveAccessStatus === "active" && resolved.activeGrant) {
    const { trialStartedAt, trialEndsAt } = getSnapshotTrialDates({
      existingAccess,
      fallbackStartedAt: resolved.activeGrant.startedAt ?? null,
      fallbackEndsAt: resolved.activeGrant.endsAt ?? null,
      nowIso,
    });

    const { error } = await supabase.from("user_access").upsert(
      {
        user_id: userId,
        access_status: "subscription_active" as SnapshotAccessStatus,
        product_tier: resolved.effectiveProductTier ?? defaultProductTier,
        trial_started_at: trialStartedAt,
        trial_ends_at: trialEndsAt,
        subscription_plan: resolved.activeGrant.subscriptionPlan,
        subscription_started_at: resolved.activeGrant.startedAt,
        subscription_ends_at: resolved.activeGrant.endsAt,
        updated_at: nowIso,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      throw new Error(`Erro ao sincronizar snapshot active: ${error.message}`);
    }

    return;
  }

  const { trialStartedAt, trialEndsAt } = getSnapshotTrialDates({
    existingAccess,
    fallbackStartedAt: existingAccess?.subscription_started_at ?? null,
    fallbackEndsAt: existingAccess?.subscription_ends_at ?? null,
    nowIso,
  });

  const { error } = await supabase.from("user_access").upsert(
    {
      user_id: userId,
      access_status: getExpiredSnapshotStatus(existingAccess),
      product_tier: defaultProductTier,
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
      subscription_plan: existingAccess?.subscription_plan ?? null,
      subscription_started_at: existingAccess?.subscription_started_at ?? null,
      subscription_ends_at: existingAccess?.subscription_ends_at ?? null,
      updated_at: nowIso,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Erro ao sincronizar snapshot expired: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  let supabase = null as ReturnType<typeof createSupabaseAdminClient> | null;
  let payload: unknown = null;
  let logId: string | null = null;
  let eventType = "";
  let orderStatus = "";
  let cpfCnpj = "";
  let subscriptionId: string | null = null;
  let orderId: string | null = null;

  const finish = async (
    status: LogProcessingStatus,
    body: Record<string, unknown>,
    httpStatus: number,
    extra?: {
      action?: string | null;
      reason?: string | null;
      errorMessage?: string | null;
      userId?: string | null;
    }
  ) => {
    if (supabase && logId) {
      const { error: logUpdateError } = await supabase
        .from("kiwify_webhook_logs")
        .update({
          processing_status: status,
          action: extra?.action ?? null,
          reason: extra?.reason ?? null,
          error_message: extra?.errorMessage ?? null,
          user_id: extra?.userId ?? null,
          event_type: eventType || null,
          order_status: orderStatus || null,
          cpf_cnpj: cpfCnpj || null,
          order_id: orderId,
          subscription_id: subscriptionId,
          response: body,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);

      if (logUpdateError) {
        console.error(
          "[kiwify/webhook] erro ao atualizar log do webhook:",
          logUpdateError
        );
      }
    }

    return NextResponse.json(body, { status: httpStatus });
  };

  try {
    const url = new URL(request.url);
    const signature = url.searchParams.get("signature");
    const expectedSignature = process.env.KIWIFY_WEBHOOK_SECRET;

    if (!expectedSignature) {
      console.error("[kiwify/webhook] KIWIFY_WEBHOOK_SECRET ausente no ambiente");

      return NextResponse.json(
        {
          ok: false,
          error: "KIWIFY_WEBHOOK_SECRET não configurada no ambiente.",
        },
        { status: 500 }
      );
    }

    if (!signature || signature !== expectedSignature) {
      console.error("[kiwify/webhook] assinatura inválida", {
        received: signature,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Webhook não autorizado.",
        },
        { status: 401 }
      );
    }

    payload = (await request.json()) as unknown;

    eventType = getEventType(payload);
    orderStatus = getOrderStatus(payload);
    cpfCnpj = getCustomerCpfCnpj(payload);
    subscriptionId = getSubscriptionId(payload);
    orderId = getOrderId(payload);

    console.log("[kiwify/webhook] evento recebido", {
      eventType,
      orderStatus,
      cpfCnpj,
      subscriptionId,
      orderId,
    });

    supabase = createSupabaseAdminClient();

    const { data: logInsert, error: logInsertError } = await supabase
      .from("kiwify_webhook_logs")
      .insert({
        event_type: eventType || null,
        order_status: orderStatus || null,
        processing_status: "received",
        cpf_cnpj: cpfCnpj || null,
        order_id: orderId,
        subscription_id: subscriptionId,
        payload: payload,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (logInsertError) {
      console.error(
        "[kiwify/webhook] erro ao criar log inicial do webhook:",
        logInsertError
      );
    } else {
      logId = logInsert?.id ?? null;
    }

    if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
      return finish(
        "ignored",
        {
          ok: true,
          ignored: true,
          reason: "cpf_cnpj_not_found_or_invalid",
          eventType,
          orderStatus,
        },
        200,
        {
          reason: "cpf_cnpj_not_found_or_invalid",
        }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, cpf_cnpj")
      .eq("cpf_cnpj", cpfCnpj)
      .maybeSingle();

    if (profileError) {
      console.error("[kiwify/webhook] erro ao buscar profile:", profileError);

      return finish(
        "error",
        {
          ok: false,
          error: "Erro ao buscar perfil do comprador.",
        },
        500,
        {
          errorMessage: "Erro ao buscar perfil do comprador.",
        }
      );
    }

    if (!profile?.user_id) {
      return finish(
        "ignored",
        {
          ok: true,
          ignored: true,
          reason: "profile_not_found",
          cpfCnpj,
          eventType,
          orderStatus,
        },
        200,
        {
          reason: "profile_not_found",
        }
      );
    }

    const { data: existingAccess, error: existingAccessError } = await supabase
      .from("user_access")
      .select(
        "user_id, access_status, product_tier, subscription_plan, subscription_started_at, subscription_ends_at, trial_started_at, trial_ends_at"
      )
      .eq("user_id", profile.user_id)
      .maybeSingle<ExistingUserAccess>();

    if (existingAccessError) {
      console.error(
        "[kiwify/webhook] erro ao buscar user_access existente:",
        existingAccessError
      );

      return finish(
        "error",
        {
          ok: false,
          error: "Erro ao carregar acesso atual do usuário.",
        },
        500,
        {
          errorMessage: "Erro ao carregar acesso atual do usuário.",
          userId: profile.user_id,
        }
      );
    }

    const productTier = mapProductTier(payload, existingAccess ?? null);

    if (isPendingPaymentEvent(payload) && !isApprovalEvent(payload)) {
      return finish(
        "ignored",
        {
          ok: true,
          ignored: true,
          reason: "pending_payment",
          cpfCnpj,
          productTier,
          eventType,
          orderStatus,
          subscriptionId,
          orderId,
        },
        200,
        {
          reason: "pending_payment",
          userId: profile.user_id,
        }
      );
    }

    if (isNegativeEvent(payload)) {
      try {
        await expireSubscriptionGrants({
          supabase,
          userId: profile.user_id,
          productTier,
          payload,
          reason: "negative_event_from_kiwify",
        });

        await syncUserAccessSnapshot({
          supabase,
          userId: profile.user_id,
          fallbackProductTier:
            existingAccess?.product_tier === "strategic" ? "strategic" : "essential",
          existingAccess: existingAccess ?? null,
        });
      } catch (expireError) {
        console.error(
          "[kiwify/webhook] erro ao expirar grants/snapshot:",
          expireError
        );

        return finish(
          "error",
          {
            ok: false,
            error: "Erro ao atualizar status da assinatura.",
          },
          500,
          {
            errorMessage: "Erro ao atualizar status da assinatura.",
            userId: profile.user_id,
          }
        );
      }

      return finish(
        "processed",
        {
          ok: true,
          processed: true,
          action: "subscription_expired",
          userId: profile.user_id,
          cpfCnpj,
          productTier,
          eventType,
          orderStatus,
          subscriptionId,
          orderId,
        },
        200,
        {
          action: "subscription_expired",
          userId: profile.user_id,
        }
      );
    }

    if (!isApprovalEvent(payload)) {
      return finish(
        "ignored",
        {
          ok: true,
          ignored: true,
          reason: "event_not_approved",
          cpfCnpj,
          productTier,
          eventType,
          orderStatus,
          subscriptionId,
          orderId,
        },
        200,
        {
          reason: "event_not_approved",
          userId: profile.user_id,
        }
      );
    }

    const plan =
      mapPlan(payload) ??
      (existingAccess?.subscription_plan as SubscriptionPlan | null) ??
      null;

    if (!plan) {
      return finish(
        "ignored",
        {
          ok: true,
          ignored: true,
          reason: "plan_not_mapped",
          cpfCnpj,
          productTier,
          eventType,
          orderStatus,
          subscriptionId,
          orderId,
        },
        200,
        {
          reason: "plan_not_mapped",
          userId: profile.user_id,
        }
      );
    }

    const { startedAt, endsAt } = resolveDates(payload, plan, existingAccess ?? null);
    const action = getActivationAction(payload, existingAccess ?? null);

    try {
      await upsertSubscriptionGrant({
        supabase,
        userId: profile.user_id,
        productTier,
        subscriptionPlan: plan,
        startedAt,
        endsAt,
        payload,
        sourceLabel: "kiwify_webhook",
      });

      await syncUserAccessSnapshot({
        supabase,
        userId: profile.user_id,
        fallbackProductTier: productTier,
        existingAccess: existingAccess ?? null,
      });
    } catch (activateError) {
      console.error(
        "[kiwify/webhook] erro ao ativar/renovar assinatura:",
        activateError
      );

      return finish(
        "error",
        {
          ok: false,
          error: "Erro ao ativar ou renovar assinatura.",
        },
        500,
        {
          errorMessage: "Erro ao ativar ou renovar assinatura.",
          userId: profile.user_id,
        }
      );
    }

    return finish(
      "processed",
      {
        ok: true,
        processed: true,
        action,
        userId: profile.user_id,
        cpfCnpj,
        productTier,
        plan,
        startedAt,
        endsAt,
        eventType,
        orderStatus,
        subscriptionId,
        orderId,
      },
      200,
      {
        action,
        userId: profile.user_id,
      }
    );
  } catch (error) {
    console.error("[kiwify/webhook] erro inesperado:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao processar webhook da Kiwify.";

    if (supabase && logId) {
      const { error: logUpdateError } = await supabase
        .from("kiwify_webhook_logs")
        .update({
          processing_status: "error",
          error_message: errorMessage,
          event_type: eventType || null,
          order_status: orderStatus || null,
          cpf_cnpj: cpfCnpj || null,
          order_id: orderId,
          subscription_id: subscriptionId,
          response: {
            ok: false,
            error: "Erro inesperado ao processar webhook da Kiwify.",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);

      if (logUpdateError) {
        console.error(
          "[kiwify/webhook] erro ao atualizar log após exceção:",
          logUpdateError
        );
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Erro inesperado ao processar webhook da Kiwify.",
      },
      { status: 500 }
    );
  }
}
