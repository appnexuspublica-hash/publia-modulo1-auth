"use server";

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { isValidCpfCnpj, onlyDigits } from "@/lib/validators";

export type SignUpState = {
  ok: boolean;
  error?: string;
  redirect?: string;
};

function admin() {
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

const schema = z.object({
  nome: z.string().min(2, "Informe seu nome"),
  cpf_cnpj: z
    .string()
    .transform((v) => onlyDigits(v))
    .refine((d) => /^\d+$/.test(d), "Informe apenas números")
    .refine(
      (d) => d.length === 11 || d.length === 14,
      "Informe CPF (11) ou CNPJ (14) dígitos"
    )
    .refine((d) => isValidCpfCnpj(d), "CPF/CNPJ inválido"),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().min(8, "Telefone inválido"),
  cidade_uf: z.string().min(2, "Cidade/UF inválido"),
  senha: z.string().min(8, "A senha precisa ter 8+ caracteres"),
  tk: z.string().optional(),
});

export async function criarConta(
  prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const supa = admin();

  // rollback best-effort do token temporário
  async function unconsumeSignupToken(token: string, usedAtIso: string) {
    try {
      await supa
        .from("signup_tokens")
        .update({ used_at: null })
        .eq("token", token)
        .eq("used_at", usedAtIso);
    } catch {
      // best-effort
    }
  }

  try {
    const raw = Object.fromEntries(formData.entries());
    const { nome, cpf_cnpj, email, telefone, cidade_uf, senha, tk } =
      schema.parse(raw);

    const emailNorm = email.trim().toLowerCase();
    const token = (tk ?? "").trim();

    // Agora o cadastro é "aberto", porém exige tk temporário
    if (!token) {
      return {
        ok: false,
        error: "Link de cadastro inválido. Volte e clique em “Criar conta” novamente.",
      };
    }

    // 1) Duplicidade no profiles (não gasta token à toa)
    const { data: existingCpf, error: existsCpfErr } = await supa
      .from("profiles")
      .select("user_id")
      .eq("cpf_cnpj", cpf_cnpj)
      .maybeSingle();

    if (existsCpfErr) {
      console.error("[signup] erro ao verificar CPF/CNPJ", existsCpfErr);
      return {
        ok: false,
        error: "Falha ao verificar CPF/CNPJ. Tente novamente.",
      };
    }
    if (existingCpf) {
      return { ok: false, error: "Já existe um cadastro com este CPF/CNPJ." };
    }

    const { data: existingEmail, error: existsEmailErr } = await supa
      .from("profiles")
      .select("user_id")
      .eq("email", emailNorm)
      .maybeSingle();

    if (existsEmailErr) {
      console.error("[signup] erro ao verificar e-mail", existsEmailErr);
      return { ok: false, error: "Falha ao verificar e-mail. Tente novamente." };
    }
    if (existingEmail) {
      return { ok: false, error: "Já existe um cadastro com este e-mail." };
    }

    // 2) Consome token temporário (uso único + expiração)
    //    - se não existir, já tiver sido usado, ou estiver expirado -> bloqueia
    const usedAtIso = new Date().toISOString();

    const { data: tokenRow, error: tokenErr } = await supa
      .from("signup_tokens")
      .update({ used_at: usedAtIso })
      .eq("token", token)
      .is("used_at", null)
      .gt("expires_at", usedAtIso)
      .select("id")
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return {
        ok: false,
        error:
          "Link de cadastro inválido ou expirado. Volte e clique em “Criar conta” novamente.",
      };
    }

    // 3) Cria usuário Auth
    const { data: created, error: authErr } = await supa.auth.admin.createUser({
      email: emailNorm,
      password: senha,
      email_confirm: true,
    });

    if (authErr || !created?.user) {
      console.error("[signup] erro ao criar user", authErr);
      await unconsumeSignupToken(token, usedAtIso);
      return { ok: false, error: "Não foi possível criar o usuário. Tente novamente." };
    }

    const userId = created.user.id;

    // 4) Cria profile
    const { error: profileErr } = await supa.from("profiles").insert({
      user_id: userId,
      nome,
      cpf_cnpj,
      email: emailNorm,
      telefone,
      cidade_uf,
    });

    if (profileErr) {
      console.error("[signup] erro ao criar profile", profileErr);
      await supa.auth.admin.deleteUser(userId).catch(() => {});
      await unconsumeSignupToken(token, usedAtIso);
      return { ok: false, error: "Falha ao salvar perfil. Tente novamente." };
    }

    // 5) Sucesso
    return {
      ok: true,
      redirect: process.env.NEXT_PUBLIC_AFTER_SIGNUP_LOGIN || "/login",
    };
  } catch (e: any) {
    console.error("[signup] error", e);
    const zIssue = e?.issues?.[0]?.message;
    return {
      ok: false,
      error: zIssue || e?.message || "Não foi possível concluir o cadastro agora.",
    };
  }
}
