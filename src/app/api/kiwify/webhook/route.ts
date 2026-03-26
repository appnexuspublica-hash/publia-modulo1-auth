//src/app/api/kiwify/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SubscriptionPlan = "monthly" | "annual";
type AccessStatus =
  | "trial_active"
  | "trial_expired"
  | "subscription_active"
  | "subscription_expired";

type KiwifyPayload = Record<string, any>;

function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function parseDate(value: unknown): string | null {
  if (!value) return null;

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
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

function getNested(obj: Record<string, any>, paths: string[][]): unknown {
  for (const path of paths) {
    let current: any = obj;

    for (const key of path) {
      if (current == null || typeof current !== "object") {
        current = undefined;
        break;
      }

      current = current[key];
    }

    if (current !== undefined && current !== null && current !== "") {
      return current;
    }
  }

  return null;
}

function getEventType(payload: KiwifyPayload): string {
  const raw = getNested(payload, [
    ["webhook_event_type"],
    ["evento", "tipo"],
    ["event"],
    ["type"],
  ]);

  return String(raw ?? "").trim().toLowerCase();
}

function getOrderStatus(payload: KiwifyPayload): string {
  const raw = getNested(payload, [
    ["status_do_pedido"],
    ["order_status"],
    ["pedido", "status"],
    ["status"],
  ]);

  return String(raw ?? "").trim().toLowerCase();
}

function getApprovedAt(payload: KiwifyPayload): string | null {
  const raw = getNested(payload, [
    ["data_aprovada"],
    ["approved_at"],
    ["order_approved_at"],
  ]);

  return parseDate(raw);
}

function getCustomerCpf(payload: KiwifyPayload): string {
  const raw = getNested(payload, [
    ["Cliente", "CPF"],
    ["cliente", "cpf"],
    ["customer", "cpf"],
    ["customer", "document"],
    ["buyer", "document"],
  ]);

  return onlyDigits(raw);
}

function getSubscriptionFrequency(payload: KiwifyPayload): string {
  const raw = getNested(payload, [
    ["Subscrição", "plano", "frequência"],
    ["Subscrição", "plano", "frequencia"],
    ["Subscrição", "plano", "frequency"],
    ["plano", "frequência"],
    ["plano", "frequencia"],
    ["plan", "frequency"],
  ]);

  return String(raw ?? "").trim().toLowerCase();
}

function getSubscriptionStart(payload: KiwifyPayload): string | null {
  const raw = getNested(payload, [
    ["Subscrição", "data_de_início"],
    ["Subscrição", "data_de_inicio"],
    ["Subscrição", "start_date"],
    ["subscription", "start_date"],
  ]);

  return parseDate(raw);
}

function getSubscriptionNextPayment(payload: KiwifyPayload): string | null {
  const raw = getNested(payload, [
    ["Subscrição", "próximo_pagamento"],
    ["Subscrição", "proximo_pagamento"],
    ["Subscrição", "next_payment"],
    ["subscription", "next_payment"],
  ]);

  return parseDate(raw);
}

function getSubscriptionStatus(payload: KiwifyPayload): string {
  const raw = getNested(payload, [
    ["Subscrição", "status"],
    ["subscription", "status"],
  ]);

  return String(raw ?? "").trim().toLowerCase();
}

function mapPlanFromPayload(payload: KiwifyPayload): SubscriptionPlan | null {
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

function isApprovalEvent(payload: KiwifyPayload): boolean {
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
    eventType === "compra_aprovada"
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

function isNegativeSubscriptionEvent(payload: KiwifyPayload): boolean {
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
    eventType.includes("expired")
  ) {
    return true;
  }

  if (
    orderStatus === "refused" ||
    orderStatus === "canceled" ||
    orderStatus === "cancelled" ||
    orderStatus === "expired"
  ) {
    return true;
  }

  if (
    subscriptionStatus === "canceled" ||
    subscriptionStatus === "cancelled" ||
    subscriptionStatus === "late" ||
    subscriptionStatus === "expired" ||
    subscriptionStatus === "inactive"
  ) {
    return true;
  }

  return false;
}

function resolveSubscriptionDates(payload: KiwifyPayload, plan: SubscriptionPlan) {
  const approvedAt = getApprovedAt(payload);
  const subscriptionStart = getSubscriptionStart(payload);
  const nextPayment = getSubscriptionNextPayment(payload);

  const startedAt = approvedAt ?? subscriptionStart ?? new Date().toISOString();

  let endsAt: string;
  if (nextPayment) {
    endsAt = nextPayment;
  } else if (plan === "monthly") {
    endsAt = addMonths(startedAt, 1);
  } else {
    endsAt = addYears(startedAt, 1);
  }

  return {
    startedAt,
    endsAt,
  };
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const signature = url.searchParams.get("signature");
    const expectedSignature = process.env.KIWIFY_WEBHOOK_SECRET;

    if (!expectedSignature) {
      return NextResponse.json(
        { ok: false, error: "KIWIFY_WEBHOOK_SECRET não configurada." },
        { status: 500 }
      );
    }

    if (!signature || signature !== expectedSignature) {
      return NextResponse.json(
        { ok: false, error: "Webhook não autorizado." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as KiwifyPayload;

    const eventType = getEventType(payload);
    const orderStatus = getOrderStatus(payload);
    const cpf = getCustomerCpf(payload);

    if (!cpf || (cpf.length !== 11 && cpf.length !== 14)) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "cpf_not_found_or_invalid",
        eventType,
        orderStatus,
      });
    }

    const supabase = createSupabaseAdminClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, cpf_cnpj")
      .eq("cpf_cnpj", cpf)
      .maybeSingle();

    if (profileError) {
      console.error("[kiwify/webhook] erro ao buscar profile", profileError);

      return NextResponse.json(
        { ok: false, error: "Erro ao buscar perfil do comprador." },
        { status: 500 }
      );
    }

    if (!profile?.user_id) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "user_not_found_by_cpf",
        cpf,
        eventType,
        orderStatus,
      });
    }

    if (isNegativeSubscriptionEvent(payload)) {
      const { error: updateError } = await supabase
        .from("user_access")
        .upsert(
          {
            user_id: profile.user_id,
            access_status: "subscription_expired" as AccessStatus,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (updateError) {
        console.error("[kiwify/webhook] erro ao expirar assinatura", updateError);

        return NextResponse.json(
          { ok: false, error: "Erro ao atualizar assinatura expirada." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        processed: true,
        action: "subscription_expired",
        userId: profile.user_id,
        cpf,
        eventType,
        orderStatus,
      });
    }

    if (!isApprovalEvent(payload)) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "event_not_approved",
        cpf,
        eventType,
        orderStatus,
      });
    }

    const plan = mapPlanFromPayload(payload);

    if (!plan) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "unknown_plan_frequency",
        cpf,
        eventType,
        orderStatus,
      });
    }

    const { startedAt, endsAt } = resolveSubscriptionDates(payload, plan);

    const { error: upsertError } = await supabase
      .from("user_access")
      .upsert(
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

    if (upsertError) {
      console.error("[kiwify/webhook] erro ao ativar assinatura", upsertError);

      return NextResponse.json(
        { ok: false, error: "Erro ao ativar assinatura." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      processed: true,
      action: "subscription_activated",
      userId: profile.user_id,
      cpf,
      plan,
      startedAt,
      endsAt,
      eventType,
      orderStatus,
    });
  } catch (error) {
    console.error("[kiwify/webhook] erro inesperado", error);

    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao processar webhook da Kiwify." },
      { status: 500 }
    );
  }
}