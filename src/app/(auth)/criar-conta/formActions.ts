"use server";

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
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

function getClientIpFromHeaders() {
  const h = headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
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

  // anti-spam
  company: z.string().optional(), // honeypot
  ts: z.string().optional(), // timestamp
});

export async function criarConta(
  prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const supa = admin();

  // 🔧 limpeza best-effort dos tokens (não pode quebrar o fluxo)
  async function cleanupBestEffort() {
    // roda em ~10% das vezes, para não chamar sempre
    if (Math.random() > 0.1) return;

    try {
      await supa.rpc("cleanup_signup_tokens", {
        p_expired_older_minutes: 60, // expirados há 1h+
        p_used_older_minutes: 24 * 60, // usados há 24h+
        p_batch: 200,
      });
    } catch {
      // best-effort: ignora
    }
  }

  await cleanupBestEffort();

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
    const { nome, cpf_cnpj, email, telefone, cidade_uf, senha, tk, company, ts } =
      schema.parse(raw);

    // Honeypot: se veio preenchido, é bot (não explique o motivo)
    if (company && company.trim().length > 0) {
      return { ok: false, error: "Não foi possível concluir o cadastro agora." };
    }

    // Anti-bot "instantâneo"
    if (ts) {
      const started = Number(ts);
      if (Number.isFinite(started)) {
        const elapsedMs = Date.now() - started;
        if (elapsedMs < 1200) {
          return { ok: false, error: "Não foi possível concluir o cadastro agora." };
        }
      }
    }

    // Rate limit no submit (por IP)
    // Ex.: 10 tentativas por hora por IP
    const ip = getClientIpFromHeaders();
    const rlKey = `signup_submit:${ip}`;

    const { data: rlData, error: rlErr } = await supa.rpc("check_rate_limit", {
      p_key: rlKey,
      p_limit: 10,
      p_window_seconds: 60 * 60,
    });

    if (!rlErr) {
      const row = Array.isArray(rlData) ? rlData[0] : rlData;
      if (row && row.allowed === false) {
        return { ok: false, error: "Muitas tentativas. Tente novamente mais tarde." };
      }
    } else {
      console.error("[rate_limit] rpc error", rlErr);
      // se falhar, não bloqueia o usuário (best-effort)
    }

    const emailNorm = email.trim().toLowerCase();
    const token = (tk ?? "").trim();

    if (!token) {
      return {
        ok: false,
        error: "Link de cadastro inválido. Volte e clique em “Criar conta” novamente.",
      };
    }

    // 1) Duplicidade no profiles
    const { data: existingCpf, error: existsCpfErr } = await supa
      .from("profiles")
      .select("user_id")
      .eq("cpf_cnpj", cpf_cnpj)
      .maybeSingle();

    if (existsCpfErr) {
      console.error("[signup] erro ao verificar CPF/CNPJ", existsCpfErr);
      return { ok: false, error: "Falha ao verificar CPF/CNPJ. Tente novamente." };
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
