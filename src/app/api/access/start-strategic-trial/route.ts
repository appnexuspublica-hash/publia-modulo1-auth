//src/app/api/access/start-strategic-trial/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applySignupTokenAccess } from "@/lib/access/applySignupTokenAccess";
import { getCurrentUserAccessByUserId } from "@/lib/access/getCurrentUserAccess";
import { reconcileUserAccessSnapshot } from "@/lib/access/reconcileUserAccessSnapshot";

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !url.startsWith("http")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL inválida. Confira seu .env.local");
  }

  if (!service) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente. Confira seu .env.local");
  }

  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuário não autenticado.",
          code: "unauthenticated",
        },
        { status: 401 },
      );
    }

    const admin = adminDb();

    const currentAccess = await getCurrentUserAccessByUserId(admin, user.id);
    const resolved = currentAccess.resolved;

    const isEligibleEssentialAccess =
      resolved.effectiveProductTier === "essential" &&
      (resolved.effectiveAccessStatus === "trial_active" ||
        resolved.effectiveAccessStatus === "subscription_active" ||
        resolved.effectiveAccessStatus === "active");

    if (!isEligibleEssentialAccess) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "O trial Estratégico está disponível uma única vez para contas Publ.IA Essencial com acesso ativo.",
          code: "essential_active_access_required",
        },
        { status: 403 },
      );
    }

    const hasConsumedStrategicTrial = resolved.grants.some(
      (grant) =>
        grant.productTier === "strategic" && grant.grantKind === "trial",
    );

    if (hasConsumedStrategicTrial) {
      return NextResponse.json(
        {
          ok: false,
          error: "Seu trial do Publ.IA Estratégico já foi utilizado.",
          code: "strategic_trial_already_consumed",
        },
        { status: 409 },
      );
    }

    const hasActiveStrategic =
      resolved.activeGrant?.productTier === "strategic" &&
      resolved.activeGrant.isCurrentlyActive;

    if (hasActiveStrategic) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sua conta já possui acesso Estratégico ativo.",
          code: "strategic_already_active",
        },
        { status: 409 },
      );
    }

    const token = crypto.randomBytes(18).toString("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const insertTokenResult = await admin.from("signup_tokens").insert({
      token,
      expires_at: expiresAt,
      product_tier: "strategic",
      grant_kind: "trial",
      trial_days: 7,
      subscription_plan: null,
      source: "essential_upgrade_button",
      notes:
        "Trial Estratégico iniciado automaticamente por usuário Essencial com acesso ativo.",
    });

    if (insertTokenResult.error) {
      console.error(
        "[start-strategic-trial] erro ao criar token interno:",
        insertTokenResult.error,
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Não foi possível iniciar o trial Estratégico.",
          code: "token_creation_failed",
        },
        { status: 500 },
      );
    }

    const applyResult = await applySignupTokenAccess({
      supabase: admin,
      userId: user.id,
      token,
    });

    if (!applyResult.ok) {
      console.error(
        "[start-strategic-trial] erro ao aplicar acesso:",
        applyResult,
      );

      if (applyResult.reason === "STRATEGIC_TRIAL_ALREADY_CONSUMED") {
        return NextResponse.json(
          {
            ok: false,
            error: "Seu trial do Publ.IA Estratégico já foi utilizado.",
            code: "strategic_trial_already_consumed",
            reason: applyResult.reason,
          },
          { status: 409 },
        );
      }

      if (applyResult.reason === "USER_ALREADY_HAS_ACTIVE_STRATEGIC") {
        return NextResponse.json(
          {
            ok: false,
            error: "Sua conta já possui acesso Estratégico ativo.",
            code: "strategic_already_active",
            reason: applyResult.reason,
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Não foi possível iniciar o trial Estratégico.",
          code: "apply_trial_failed",
          reason: applyResult.reason,
        },
        { status: 500 },
      );
    }

    try {
      await reconcileUserAccessSnapshot({
        supabase: admin,
        userId: user.id,
      });
    } catch (reconcileError) {
      console.error(
        "[start-strategic-trial] falha ao reconciliar snapshot após trial:",
        reconcileError,
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Trial Estratégico iniciado com sucesso.",
      appliedProductTier: applyResult.appliedProductTier,
      appliedGrantKind: applyResult.appliedGrantKind,
      tokenId: applyResult.tokenId,
    });
  } catch (error) {
    console.error("Erro em /api/access/start-strategic-trial:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno ao iniciar o trial Estratégico.",
        code: "internal_error",
      },
      { status: 500 },
    );
  }
}
