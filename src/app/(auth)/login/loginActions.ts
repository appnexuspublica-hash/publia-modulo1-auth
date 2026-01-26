"use server";

import { z } from "zod";
import { onlyDigits } from "@/lib/validators";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = {
  ok: boolean;
  error?: string;
  redirect?: string;
};

const schema = z.object({
  cpf_cnpj: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z
      .string()
      .min(1, "Informe seu CPF ou CNPJ.")
      .transform((v) => onlyDigits(v))
      .refine(
        (v) => v.length === 11 || v.length === 14,
        "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)."
      )
  ),
  senha: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z.string().min(1, "Informe sua senha.")
  ),
});

export async function login(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    const parsed = schema.parse({
      cpf_cnpj: formData.get("cpf_cnpj"),
      senha: formData.get("senha"),
    });

    // 1) ADMIN: localizar e-mail a partir do cpf/cnpj no profiles
    const supaAdmin = createSupabaseAdminClient();

    const { data: profile, error: profileErr } = await supaAdmin
      .from("profiles")
      .select("email")
      .eq("cpf_cnpj", parsed.cpf_cnpj)
      .maybeSingle();

    if (profileErr) {
      console.error("[login] profiles lookup error", profileErr);
      return { ok: false, error: "Não foi possível validar seu acesso. Tente novamente." };
    }

    if (!profile?.email) {
      return { ok: false, error: "Credenciais inválidas." };
    }

    // 2) SERVER (cookie-based): autenticar (grava sessão em cookie)
    const supa = createSupabaseServerClient();

    const { error: signErr } = await supa.auth.signInWithPassword({
      email: profile.email,
      password: parsed.senha,
    });

    if (signErr) {
      const msg =
        signErr.message?.toLowerCase().includes("invalid") ||
        signErr.message?.toLowerCase().includes("credentials")
          ? "Credenciais inválidas."
          : "Não foi possível entrar agora.";
      return { ok: false, error: msg };
    }

    // 3) Sucesso -> front faz router.push
    return { ok: true, redirect: "/chat" };
  } catch (e: any) {
    console.error("[login] error", e);
    const zIssue = e?.issues?.[0]?.message;
    return {
      ok: false,
      error: zIssue || e?.message || "Não foi possível entrar agora.",
    };
  }
}
