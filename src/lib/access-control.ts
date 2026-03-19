// src/lib/access-control.ts

export type AccessStatus =
  | "trial_active"
  | "trial_expired"
  | "subscription_active"
  | "subscription_expired";

export type AccessSummary = {
  user_id: string;
  access_status: AccessStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_message_limit: number;
  subscription_plan: string | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  messages_used: number;
  pdf_uploads_used: number;
  input_tokens_used: number;
  output_tokens_used: number;
  total_tokens_used: number;
};

export type AccessDecision = {
  allowed: boolean;
  effectiveStatus: AccessStatus;
  reason:
    | null
    | "trial_time_expired"
    | "trial_message_limit_reached"
    | "trial_inactive"
    | "subscription_expired";
  message: string | null;
};

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function evaluateAccess(summary: AccessSummary): AccessDecision {
  const now = new Date();

  const trialEndsAt = toDate(summary.trial_ends_at);
  const subscriptionEndsAt = toDate(summary.subscription_ends_at);

  const messagesUsed = Number(summary.messages_used ?? 0);
  const trialMessageLimit = Number(summary.trial_message_limit ?? 75);

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
    trial_message_limit: 75,
  });

  if (insertErr) {
    console.error("[access-control] erro ao criar user_access automaticamente", insertErr);
    return false;
  }

  return true;
}

async function getAccessSummaryFromView(client: any, userId: string): Promise<AccessSummary | null> {
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

  return data as AccessSummary;
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
    trial_message_limit: Number(accessRow.trial_message_limit ?? 75),
    subscription_plan: accessRow.subscription_plan ?? null,
    subscription_started_at: accessRow.subscription_started_at ?? null,
    subscription_ends_at: accessRow.subscription_ends_at ?? null,
    messages_used: messagesUsed,
    pdf_uploads_used: pdfUploadsUsed,
    input_tokens_used: inputTokensUsed,
    output_tokens_used: outputTokensUsed,
    total_tokens_used: totalTokensUsed,
  };
}

export async function getAccessSummary(client: any, userId: string): Promise<AccessSummary | null> {
  const fromView = await getAccessSummaryFromView(client, userId);
  if (fromView) {
    return fromView;
  }

  const fromTables = await getAccessSummaryFromTables(client, userId);
  if (fromTables) {
    return fromTables;
  }

  console.error("[access-control] nenhum resumo de acesso encontrado para user_id:", userId);
  return null;
}

export async function syncEffectiveAccessStatus(client: any, summary: AccessSummary) {
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