// src/app/api/admin/reset-user-password/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ResetPasswordBody = {
  userId?: string;
  newPassword?: string;
};

function isValidPassword(password: string) {
  return password.length >= 8;
}

/**
 * Comparação em tempo constante sem depender de Buffer/timingSafeEqual,
 * evitando incompatibilidades de tipagem entre versões de @types/node.
 */
function safeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i] ^ bBytes[i];
  }

  return diff === 0;
}

async function isInternalAdminRequest(request: Request) {
  const expectedKey = process.env.ADMIN_INTERNAL_API_KEY;
  const receivedKey = request.headers.get("x-admin-api-key");

  if (!expectedKey || !receivedKey) {
    return false;
  }

  return safeEqual(receivedKey, expectedKey);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResetPasswordBody;
    const userId = body.userId?.trim();
    const newPassword = body.newPassword?.trim();

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: "userId e newPassword são obrigatórios." },
        { status: 400 }
      );
    }

    if (!isValidPassword(newPassword)) {
      return NextResponse.json(
        { error: "A nova senha deve ter pelo menos 8 caracteres." },
        { status: 400 }
      );
    }

    const internalAdminRequest = await isInternalAdminRequest(request);

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      }
    );

    let performedBy: {
      id: string | null;
      nome: string | null;
      email: string | null;
      authMode: "session_admin" | "internal_api_key";
    } = {
      id: null,
      nome: null,
      email: null,
      authMode: "internal_api_key",
    };

    if (!internalAdminRequest) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          {
            error:
              "Usuário não autenticado. Faça login como admin ou envie x-admin-api-key.",
          },
          { status: 401 }
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, is_admin, role, nome, email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        return NextResponse.json(
          { error: "Erro ao validar perfil do administrador." },
          { status: 500 }
        );
      }

      const isAdmin = profile?.is_admin === true || profile?.role === "admin";

      if (!isAdmin) {
        return NextResponse.json(
          {
            error:
              "Acesso negado. Somente administradores podem redefinir senha.",
          },
          { status: 403 }
        );
      }

      performedBy = {
        id: user.id,
        nome: profile?.nome ?? null,
        email: profile?.email ?? user.email ?? null,
        authMode: "session_admin",
      };
    }

    const admin = createSupabaseAdminClient();

    const { data: targetUser, error: targetUserError } =
      await admin.auth.admin.getUserById(userId);

    if (targetUserError || !targetUser?.user) {
      return NextResponse.json(
        { error: "Usuário alvo não encontrado." },
        { status: 404 }
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      userId,
      {
        password: newPassword,
      }
    );

    if (updateError) {
      return NextResponse.json(
        {
          error: "Não foi possível redefinir a senha.",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Senha redefinida com sucesso.",
      targetUser: {
        id: targetUser.user.id,
        email: targetUser.user.email ?? null,
      },
      performedBy,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno inesperado.";

    return NextResponse.json(
      { error: "Erro ao redefinir senha.", details: message },
      { status: 500 }
    );
  }
}
