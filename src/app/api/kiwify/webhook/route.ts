// src/app/api/kiwify/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SubscriptionPlan = "monthly" | "annual";

type AccessStatus =
  | "trial_active"
  | "trial_expired"
  | "subscription_active"
  | "subscription_expired";

type JsonRecord = Record<string, unknown>;

type ExistingUserAccess = {
  user_id: string;
  access_status: AccessStatus;
  subscription_plan: SubscriptionPlan | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
};

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
    subscriptionStatus === "inactive" ||
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
    getEarlierDate(existingAccess?.subscription_started_at ?? null, baseStartedAt) ??
    baseStartedAt;

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

  if (existingAccess?.access_status === "subscription_active") {
    return "subscription_renewed";
  }

  return "subscription_activated";
}

export async function POST(request: NextRequest) {
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

    const payload = (await request.json()) as unknown;

    const eventType = getEventType(payload);
    const orderStatus = getOrderStatus(payload);
    const cpfCnpj = getCustomerCpfCnpj(payload);
    const subscriptionId = getSubscriptionId(payload);
    const orderId = getOrderId(payload);

    console.log("[kiwify/webhook] evento recebido", {
      eventType,
      orderStatus,
      cpfCnpj,
      subscriptionId,
      orderId,
    });

    if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "cpf_cnpj_not_found_or_invalid",
        eventType,
        orderStatus,
      });
    }

    const supabase = createSupabaseAdminClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, cpf_cnpj")
      .eq("cpf_cnpj", cpfCnpj)
      .maybeSingle();

    if (profileError) {
      console.error("[kiwify/webhook] erro ao buscar profile:", profileError);

      return NextResponse.json(
        {
          ok: false,
          error: "Erro ao buscar perfil do comprador.",
        },
        { status: 500 }
      );
    }

    if (!profile?.user_id) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "profile_not_found",
        cpfCnpj,
        eventType,
        orderStatus,
      });
    }

    const { data: existingAccess, error: existingAccessError } = await supabase
      .from("user_access")
      .select(
        "user_id, access_status, subscription_plan, subscription_started_at, subscription_ends_at"
      )
      .eq("user_id", profile.user_id)
      .maybeSingle<ExistingUserAccess>();

    if (existingAccessError) {
      console.error(
        "[kiwify/webhook] erro ao buscar user_access existente:",
        existingAccessError
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Erro ao carregar acesso atual do usuário.",
        },
        { status: 500 }
      );
    }

    if (isNegativeEvent(payload)) {
      const { error: expireError } = await supabase.from("user_access").upsert(
        {
          user_id: profile.user_id,
          access_status: "subscription_expired" as AccessStatus,
          subscription_plan: existingAccess?.subscription_plan ?? mapPlan(payload),
          subscription_started_at:
            existingAccess?.subscription_started_at ?? getSubscriptionStart(payload),
          subscription_ends_at:
            existingAccess?.subscription_ends_at ?? getSubscriptionNextPayment(payload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (expireError) {
        console.error(
          "[kiwify/webhook] erro ao marcar assinatura expirada:",
          expireError
        );

        return NextResponse.json(
          {
            ok: false,
            error: "Erro ao atualizar status da assinatura.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        processed: true,
        action: "subscription_expired",
        userId: profile.user_id,
        cpfCnpj,
        eventType,
        orderStatus,
      });
    }

    if (!isApprovalEvent(payload)) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "event_not_approved",
        cpfCnpj,
        eventType,
        orderStatus,
      });
    }

    const plan = mapPlan(payload) ?? existingAccess?.subscription_plan ?? null;

    if (!plan) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "plan_not_mapped",
        cpfCnpj,
        eventType,
        orderStatus,
      });
    }

    const { startedAt, endsAt } = resolveDates(payload, plan, existingAccess ?? null);
    const action = getActivationAction(payload, existingAccess ?? null);

    const { error: activateError } = await supabase.from("user_access").upsert(
      {
        user_id: profile.user_id,
        access_status: "subscription_active" as AccessStatus,
        subscription_plan: plan,
        subscription_started_at: startedAt,
        subscription_ends_at: endsAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (activateError) {
      console.error(
        "[kiwify/webhook] erro ao ativar/renovar assinatura:",
        activateError
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Erro ao ativar ou renovar assinatura.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      processed: true,
      action,
      userId: profile.user_id,
      cpfCnpj,
      plan,
      startedAt,
      endsAt,
      eventType,
      orderStatus,
      subscriptionId,
      orderId,
    });
  } catch (error) {
    console.error("[kiwify/webhook] erro inesperado:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro inesperado ao processar webhook da Kiwify.",
      },
      { status: 500 }
    );
  }
}