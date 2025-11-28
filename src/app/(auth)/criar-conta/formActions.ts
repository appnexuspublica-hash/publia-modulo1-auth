"use server";

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { isValidCpfCnpj, onlyDigits } from "../../../lib/validators";

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
  try {
    const raw = Object.fromEntries(formData.entries());
    const { nome, cpf_cnpj, email, telefone, cidade_uf, senha, tk } =
      schema.parse(raw);

    const tokenEnv = process.env.SIGNUP_TOKEN;
    const tokenOk = !!tokenEnv && tk === tokenEnv;

    if (!tokenOk) {
      return { ok: false, error: "Cadastro bloqueado. Token inválido." };
    }

    const supa = admin();

    // 1) Verifica se já existe perfil com o mesmo CPF/CNPJ
    const { data: existing, error: existsErr } = await supa
      .from("profiles")
      .select("user_id")
      .eq("cpf_cnpj", cpf_cnpj)
      .maybeSingle();

    if (existsErr) {
      console.error("[signup] erro ao verificar CPF/CNPJ", existsErr);
      return {
        ok: false,
        error: "Falha ao verificar CPF/CNPJ. Tente novamente.",
      };
    }

    if (existing) {
      return {
        ok: false,
        error: "Já existe um cadastro com este CPF/CNPJ.",
      };
    }

    // 2) Cria usuário de autenticação
    const { data: created, error: authErr } = await supa.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });

    if (authErr || !created?.user) {
      console.error("[signup] erro ao criar user", authErr);
      return {
        ok: false,
        error: "Não foi possível criar o usuário. Tente novamente.",
      };
    }

    const userId = created.user.id;

    // 3) Cria registro em profiles
    const { error: profileErr } = await supa.from("profiles").insert({
      user_id: userId,
      nome,
      cpf_cnpj,
      email,
      telefone,
      cidade_uf,
    });

    if (profileErr) {
      console.error("[signup] erro ao criar profile", profileErr);
      // rollback simples: remove o user criado
      await supa.auth.admin.deleteUser(userId).catch(() => {});
      return {
        ok: false,
        error: "Falha ao salvar perfil. Tente novamente.",
      };
    }

    // 4) Sucesso
    return {
      ok: true,
      redirect: process.env.NEXT_PUBLIC_AFTER_SIGNUP_LOGIN || "/login",
    };
  } catch (e: any) {
    console.error("[signup] error", e);
    const zIssue = e?.issues?.[0]?.message;
    return {
      ok: false,
      error:
        zIssue ||
        e?.message ||
        "Não foi possível concluir o cadastro agora.",
    };
  }
}

