//src/app/(auth)/criar-conta/formActions.ts
"use server";

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { isValidCpfCnpj, onlyDigits } from "@/lib/validators";
import { applySignupTokenAccess } from "@/lib/access/applySignupTokenAccess";

export type SignUpState = {
  ok: boolean;
  error?: string;
  redirect?: string;
  code?: string;
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
    .refine((d) => d.length === 11 || d.length === 14, "Informe CPF (11) ou CNPJ (14) dígitos")
    .refine((d) => isValidCpfCnpj(d), "CPF/CNPJ inválido"),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().min(8, "Telefone inválido"),
  municipio: z.string().min(2, "Município inválido"),
  uf: z
    .string()
    .min(2, "Estado/UF inválido")
    .max(2, "Estado/UF inválido")
    .transform((v) => v.trim().toUpperCase()),
  porte_municipio: z
    .string()
    .refine((v) => ["pequeno", "medio", "grande"].includes(v), "Selecione o porte do município"),
  senha: z.string().min(8, "A senha precisa ter 8+ caracteres"),
  tk: z.string().optional(),
  order_id: z.string().optional(),
  company: z.string().optional(),
  publia_hp: z.string().optional(),
  ts: z.string().optional(),
});


type PendingSignupTokenRow = {
  token: string;
  expires_at: string | null;
  product_tier: string | null;
  grant_kind: string | null;
  subscription_plan: string | null;
  source: string | null;
};

function hasDateExpired(value: string | null | undefined): boolean {
  if (!value) return false;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.getTime() < Date.now();
}

async function findPendingPaidSignupToken(params: {
  supa: ReturnType<typeof admin>;
  cpfCnpj: string;
  email: string;
  orderId?: string | null;
}): Promise<{ token: string | null; error: string | null }> {
  const { supa } = params;
  const cpfCnpj = onlyDigits(params.cpfCnpj);
  const email = params.email.trim().toLowerCase();
  const orderId = (params.orderId ?? "").trim();

  async function fetchCandidatesBy(field: "order_id" | "cpf_cnpj" | "email", value: string) {
    if (!value) return { rows: [] as PendingSignupTokenRow[], error: null as any };

    const { data, error } = await supa
      .from("signup_tokens")
      .select("token, expires_at, product_tier, grant_kind, subscription_plan, source")
      .eq("grant_kind", "subscription")
      .is("used_at", null)
      .eq(field, value)
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      rows: ((data ?? []) as PendingSignupTokenRow[]),
      error,
    };
  }

  async function getValidTokenFrom(
    field: "order_id" | "cpf_cnpj" | "email",
    value: string,
  ): Promise<{ token: string | null; error: string | null }> {
    const { rows, error } = await fetchCandidatesBy(field, value);

    if (error) {
      console.error(`[signup] erro ao buscar compra pendente por ${field}`, error);
      return {
        token: null,
        error: "Não foi possível verificar sua compra. Tente novamente em alguns instantes.",
      };
    }

    const validToken = rows.find(
      (row) =>
        row.token &&
        row.grant_kind === "subscription" &&
        (row.product_tier === "essential" || row.product_tier === "strategic") &&
        !hasDateExpired(row.expires_at),
    );

    return { token: validToken?.token ?? null, error: null };
  }

  // Ordem proposital:
  // 1) order_id, quando vier da rota de retorno;
  // 2) CPF/CNPJ normalizado;
  // 3) e-mail normalizado.
  //
  // Evitamos `.or(...)` aqui porque valores de e-mail e CPF/CNPJ podem gerar
  // falsos negativos ou parsing frágil no PostgREST. Consultas separadas são
  // mais previsíveis para o fluxo crítico de comprador pago.
  if (orderId) {
    const byOrder = await getValidTokenFrom("order_id", orderId);
    if (byOrder.error || byOrder.token) return byOrder;
  }

  if (cpfCnpj) {
    const byCpf = await getValidTokenFrom("cpf_cnpj", cpfCnpj);
    if (byCpf.error || byCpf.token) return byCpf;
  }

  if (email) {
    const byEmail = await getValidTokenFrom("email", email);
    if (byEmail.error || byEmail.token) return byEmail;
  }

  return { token: null, error: null };
}

export async function criarConta(
  prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const supa = admin();

  async function cleanupBestEffort() {
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

  await cleanupBestEffort();

  try {
    const raw = Object.fromEntries(formData.entries());

    const {
      nome,
      cpf_cnpj,
      email,
      telefone,
      municipio,
      uf,
      porte_municipio,
      senha,
      tk,
      order_id,
      company,
      publia_hp,
      ts,
    } = schema.parse(raw);

    // O campo "company" era um honeypot antigo e alguns navegadores podem
    // preenchê-lo automaticamente em compras reais. Por isso ele não bloqueia
    // mais cadastro. Mantemos somente um log discreto para auditoria.
    if ((company && company.trim().length > 0) || (publia_hp && publia_hp.trim().length > 0)) {
      console.warn("[signup] honeypot preenchido, ignorando para evitar falso positivo em comprador real");
    }

    if (ts) {
      const started = Number(ts);
      if (Number.isFinite(started)) {
        const elapsedMs = Date.now() - started;
        if (elapsedMs < 700) {
          return { ok: false, error: "Não foi possível concluir o cadastro agora." };
        }
      }
    }

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
    }

    const emailNorm = email.trim().toLowerCase();
    let token = (tk ?? "").trim();

    if (!token) {
      const pendingTokenResult = await findPendingPaidSignupToken({
        supa,
        cpfCnpj: cpf_cnpj,
        email: emailNorm,
        orderId: order_id,
      });

      if (pendingTokenResult.error) {
        return {
          ok: false,
          error: pendingTokenResult.error,
          code: "pending_purchase_lookup_failed",
        };
      }

      if (!pendingTokenResult.token) {
        return {
          ok: false,
          error:
            "Não encontramos uma compra aprovada para este CPF/CNPJ ou e-mail. Se você comprou agora, use os mesmos dados informados na compra ou aguarde alguns instantes e tente novamente.",
          code: "paid_signup_not_found",
        };
      }

      token = pendingTokenResult.token;
    }

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

    const { data: created, error: authErr } = await supa.auth.admin.createUser({
      email: emailNorm,
      password: senha,
      email_confirm: true,
    });

    if (authErr || !created?.user) {
      console.error("[signup] erro ao criar user", authErr);

      if (authErr?.code === "email_exists") {
        return {
          ok: false,
          error: "Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
        };
      }

      return {
        ok: false,
        error: "Não foi possível criar o usuário. Tente novamente.",
      };
    }

    const userId = created.user.id;

    const { error: profileErr } = await supa.from("profiles").insert({
      user_id: userId,
      nome,
      cpf_cnpj,
      email: emailNorm,
      telefone,
      municipio,
      uf,
      cidade_uf: `${municipio} / ${uf}`,
      porte_municipio,
    });

    if (profileErr) {
      console.error("[signup] erro ao criar profile", profileErr);
      await supa.auth.admin.deleteUser(userId).catch(() => {});
      return { ok: false, error: "Falha ao salvar perfil. Tente novamente." };
    }

    const accessResult = await applySignupTokenAccess({
      supabase: supa,
      userId,
      token,
    });

    if (!accessResult.ok) {
      console.error("[signup] erro ao aplicar token de acesso", accessResult);

      try {
        await supa.from("profiles").delete().eq("user_id", userId);
      } catch {
        // best-effort rollback
      }

      try {
        await supa.auth.admin.deleteUser(userId);
      } catch {
        // best-effort rollback
      }

      if (
        accessResult.reason === "TOKEN_NOT_FOUND" ||
        accessResult.reason === "TOKEN_ALREADY_USED" ||
        accessResult.reason === "TOKEN_EXPIRED" ||
        accessResult.reason === "TOKEN_INVALID_PRODUCT_TIER" ||
        accessResult.reason === "TOKEN_INVALID_GRANT_KIND"
      ) {
        return {
          ok: false,
          error: "Link de cadastro inválido ou expirado. Volte e clique em “Criar conta” novamente.",
          code: "signup_token_invalid",
        };
      }

      if (accessResult.reason === "ESSENTIAL_TRIAL_ALREADY_CONSUMED") {
        return {
          ok: false,
          error: "Este usuário já consumiu o trial do Publ.IA Essencial.",
          code: "essential_trial_already_consumed",
        };
      }

      if (accessResult.reason === "STRATEGIC_TRIAL_ALREADY_CONSUMED") {
        return {
          ok: false,
          error: "Este usuário já consumiu o trial do Publ.IA Estratégico.",
          code: "strategic_trial_already_consumed",
        };
      }

      if (accessResult.reason === "USER_ALREADY_HAS_ACTIVE_ESSENTIAL") {
        return {
          ok: false,
          error: "Este usuário já possui acesso Essencial ativo.",
          code: "essential_already_active",
        };
      }

      if (accessResult.reason === "USER_ALREADY_HAS_ACTIVE_STRATEGIC") {
        return {
          ok: false,
          error: "Este usuário já possui acesso Estratégico ativo.",
          code: "strategic_already_active",
        };
      }

      return {
        ok: false,
        error: "Não foi possível concluir a liberação de acesso. Tente novamente.",
        code: "signup_access_apply_failed",
      };
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