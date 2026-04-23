//src/app/(auth)/recuperar-senha/resetActions.ts
"use server";

import { createClient } from "@supabase/supabase-js";

type ResetState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function resetAction(
  _prevState: ResetState,
  formData: FormData
): Promise<ResetState> {
  const cpf_cnpj = onlyDigits(String(formData.get("cpf_cnpj") ?? ""));
  const senha = String(formData.get("senha") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!cpf_cnpj) {
    return { ok: false, error: "Informe seu CPF/CNPJ." };
  }

  if (!senha || !confirm) {
    return { ok: false, error: "Preencha a nova senha e a confirmacao." };
  }

  if (senha !== confirm) {
    return { ok: false, error: "As senhas nao conferem." };
  }

  if (senha.length < 6) {
    return { ok: false, error: "A senha deve ter pelo menos 6 caracteres." };
  }

  try {
    const supa = admin();

    const { data: prof, error: profErr } = await supa
      .from("profiles")
      .select("user_id")
      .eq("cpf_cnpj", cpf_cnpj)
      .maybeSingle();

    if (profErr) {
      console.error("[resetAction] erro ao buscar perfil:", profErr);
      return { ok: false, error: "Nao foi possivel localizar o usuario." };
    }

    if (!prof?.user_id) {
      return { ok: false, error: "Usuario nao encontrado para o CPF/CNPJ informado." };
    }

    const { error: updErr } = await supa.auth.admin.updateUserById(prof.user_id, {
      password: senha,
    });

    if (updErr) {
      console.error("[resetAction] erro ao atualizar senha:", updErr);
      return { ok: false, error: "Nao foi possivel atualizar a senha." };
    }

    return {
      ok: true,
      message: "Senha cadastrada com sucesso. Voce ja pode fazer login.",
    };
  } catch (err) {
    console.error("[resetAction] erro inesperado:", err);
    return { ok: false, error: "Erro interno ao processar a solicitacao." };
  }
}