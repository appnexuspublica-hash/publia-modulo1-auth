//src/app/api/access/apply-token/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applySignupTokenAccess } from "@/lib/access/applySignupTokenAccess";

type ApplyTokenBody = {
  token?: string;
};

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

function normalizeBody(input: unknown): ApplyTokenBody {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const body = input as Record<string, unknown>;

  return {
    token:
      typeof body.token === "string" && body.token.trim().length > 0
        ? body.token.trim()
        : undefined,
  };
}

export async function POST(req: Request) {
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

    let body: ApplyTokenBody = {};

    try {
      const rawBody = await req.json().catch(() => null);
      body = normalizeBody(rawBody);
    } catch {
      body = {};
    }

    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Token é obrigatório.",
          code: "token_required",
        },
        { status: 400 },
      );
    }

    const admin = adminDb();

    const result = await applySignupTokenAccess({
      supabase: admin,
      userId: user.id,
      token,
    });

    if (!result.ok) {
      if (
        result.reason === "TOKEN_NOT_FOUND" ||
        result.reason === "TOKEN_ALREADY_USED" ||
        result.reason === "TOKEN_EXPIRED" ||
        result.reason === "TOKEN_INVALID_PRODUCT_TIER" ||
        result.reason === "TOKEN_INVALID_GRANT_KIND"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Token inválido, expirado ou já utilizado.",
            code: "token_invalid",
            reason: result.reason,
          },
          { status: 400 },
        );
      }

      if (result.reason === "ESSENTIAL_TRIAL_ALREADY_CONSUMED") {
        return NextResponse.json(
          {
            ok: false,
            error: "Este usuário já consumiu o trial do Publ.IA Essencial.",
            code: "essential_trial_already_consumed",
            reason: result.reason,
          },
          { status: 409 },
        );
      }

      if (result.reason === "STRATEGIC_TRIAL_ALREADY_CONSUMED") {
        return NextResponse.json(
          {
            ok: false,
            error: "Este usuário já consumiu o trial do Publ.IA Estratégico.",
            code: "strategic_trial_already_consumed",
            reason: result.reason,
          },
          { status: 409 },
        );
      }

      if (result.reason === "USER_ALREADY_HAS_ACTIVE_ESSENTIAL") {
        return NextResponse.json(
          {
            ok: false,
            error: "Este usuário já possui acesso Essencial ativo.",
            code: "essential_already_active",
            reason: result.reason,
          },
          { status: 409 },
        );
      }

      if (result.reason === "USER_ALREADY_HAS_ACTIVE_STRATEGIC") {
        return NextResponse.json(
          {
            ok: false,
            error: "Este usuário já possui acesso Estratégico ativo.",
            code: "strategic_already_active",
            reason: result.reason,
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Não foi possível aplicar o token de acesso.",
          code: "apply_token_failed",
          reason: result.reason,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Token aplicado com sucesso.",
      tokenId: result.tokenId,
      userId: result.userId,
      appliedProductTier: result.appliedProductTier,
      appliedGrantKind: result.appliedGrantKind,
    });
  } catch (error) {
    console.error("Erro em /api/access/apply-token:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno ao aplicar token de acesso.",
        code: "internal_error",
      },
      { status: 500 },
    );
  }
}
