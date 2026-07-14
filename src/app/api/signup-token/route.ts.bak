//src/app/api/signup-token/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

type ProductTier = "essential" | "strategic";
type GrantKind = "trial" | "subscription" | "upgrade";

type CreateSignupTokenBody = {
  plan?: ProductTier;
  product_tier?: ProductTier;
  grant_kind?: GrantKind;
  trial_days?: number | null;
  subscription_plan?: string | null;
  source?: string | null;
  notes?: string | null;
  expires_in_minutes?: number | null;
};

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    throw new Error("Supabase envs faltando");
  }

  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

async function checkRateLimit(
  supa: ReturnType<typeof adminDb>,
  key: string,
  limit: number,
  windowSeconds: number
) {
  const { data, error } = await supa.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("[rate_limit] rpc error", error);
    return { allowed: true };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: !!row?.allowed };
}

async function cleanupBestEffort(supa: ReturnType<typeof adminDb>) {
  if (Math.random() > 0.1) return;

  try {
    await supa.rpc("cleanup_signup_tokens", {
      p_expired_older_minutes: 60,
      p_used_older_minutes: 24 * 60,
      p_batch: 200,
    });
  } catch {
    // best-effort
  }
}

function isProductTier(value: unknown): value is ProductTier {
  return value === "essential" || value === "strategic";
}

function isGrantKind(value: unknown): value is GrantKind {
  return value === "trial" || value === "subscription" || value === "upgrade";
}

function getDefaultTrialDays(productTier: ProductTier) {
  return productTier === "strategic" ? 7 : 15;
}

function resolveDefaultSource(productTier: ProductTier) {
  return productTier === "strategic"
    ? "login_strategic_button"
    : "login_essential_button";
}

function normalizeBody(input: unknown): CreateSignupTokenBody {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const body = input as Record<string, unknown>;
  const plan = isProductTier(body.plan) ? body.plan : undefined;
  const productTier = isProductTier(body.product_tier) ? body.product_tier : undefined;

  return {
    plan,
    product_tier: productTier ?? plan,
    grant_kind: isGrantKind(body.grant_kind) ? body.grant_kind : undefined,
    trial_days:
      typeof body.trial_days === "number" && Number.isFinite(body.trial_days)
        ? body.trial_days
        : null,
    subscription_plan:
      typeof body.subscription_plan === "string" && body.subscription_plan.trim().length > 0
        ? body.subscription_plan.trim()
        : null,
    source:
      typeof body.source === "string" && body.source.trim().length > 0
        ? body.source.trim()
        : null,
    notes:
      typeof body.notes === "string" && body.notes.trim().length > 0
        ? body.notes.trim()
        : null,
    expires_in_minutes:
      typeof body.expires_in_minutes === "number" && Number.isFinite(body.expires_in_minutes)
        ? body.expires_in_minutes
        : null,
  };
}

export async function POST(req: Request) {
  try {
    const supa = adminDb();

    await cleanupBestEffort(supa);

    const ip = getClientIp(req);
    const key = `signup_token:${ip}`;
    const rl = await checkRateLimit(supa, key, 20, 60 * 60);

    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Muitas tentativas. Tente novamente mais tarde." },
        { status: 429 }
      );
    }

    let body: CreateSignupTokenBody = {};

    try {
      const rawBody = await req.json().catch(() => null);
      body = normalizeBody(rawBody);
    } catch {
      body = {};
    }

    const productTier: ProductTier = body.product_tier ?? body.plan ?? "essential";
    const grantKind: GrantKind = body.grant_kind ?? "trial";

    const trialDays =
      grantKind === "trial"
        ? typeof body.trial_days === "number" && body.trial_days > 0
          ? Math.floor(body.trial_days)
          : getDefaultTrialDays(productTier)
        : null;

    const expiresInMinutes =
      typeof body.expires_in_minutes === "number" && body.expires_in_minutes > 0
        ? Math.floor(body.expires_in_minutes)
        : 10;

    const token = crypto.randomBytes(18).toString("base64url");
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    const insertPayload = {
      token,
      expires_at: expiresAt,
      product_tier: productTier,
      grant_kind: grantKind,
      trial_days: trialDays,
      subscription_plan: body.subscription_plan ?? null,
      source: body.source ?? resolveDefaultSource(productTier),
      notes: body.notes ?? null,
    };

    const { error } = await supa.from("signup_tokens").insert(insertPayload);

    if (error) {
      console.error("[signup-token] insert error", error);

      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      token,
      expiresAt,
      plan: productTier,
      product_tier: productTier,
      grant_kind: grantKind,
      trial_days: trialDays,
      subscription_plan: body.subscription_plan ?? null,
      source: body.source ?? resolveDefaultSource(productTier),
      notes: body.notes ?? null,
    });
  } catch (error) {
    console.error("[signup-token] unexpected error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro interno desconhecido.",
      },
      { status: 500 }
    );
  }
}
