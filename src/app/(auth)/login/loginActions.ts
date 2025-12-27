"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { onlyDigits } from "@/lib/validators";

export type LoginState = {
  ok: boolean;
  error?: string;
  redirect?: string;
};

// Client ADMIN (service role) – apenas para ler profiles
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !url.startsWith("http")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL inválida. Confira o .env.local");
  }
  if (!service) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente. Confira o .env.local");
  }

  return createSupabaseClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Client PÚBLICO + COOKIES (SSR) – para autenticar e gravar sessão no navegador
function pub() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !url.startsWith("http")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL inválida. Confira o .env.local");
  }
  if (!anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente. Confira o .env.local"
    );
  }

  const cookieStore = cookies();

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

const schema = z.object({
  cpf_cnpj: z
    .string()
    .transform((v) => onlyDigits(v))
    .refine((d) => /^\d+$/.test(d), "Informe apenas números")
    .refine(
      (d) => d.length === 11 || d.length === 14,
      "Informe CPF (11) ou CNPJ (14)"
    ),
  senha: z.string().min(1, "Informe sua senha"),
});

export async function login(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const { cpf_cnpj, senha } = schema.parse(raw);

    // 1) Buscar e-mail pelo CPF/CNPJ (usando service role)
    const adm = admin();
    const { data: prof, error: e1 } = await adm
      .from("profiles")
      .select("email")
      .eq("cpf_cnpj", cpf_cnpj)
      .maybeSingle();

    if (e1) {
      console.error("[login] erro ao consultar cadastro", e1);
      return {
        ok: false,
        // DEBUG TEMPORÁRIO – assim sabemos que veio daqui
        error: `DEBUG LOGIN v2 – erro Supabase ao consultar profiles: ${e1.message}`,
      };
    }

    if (!prof?.email) {
      return { ok: false, error: "CPF/CNPJ não encontrado." };
    }

    // 2) Autenticar usuário (gravando sessão em cookie via SSR)
    const client = pub();
    const { error: e2 } = await client.auth.signInWithPassword({
      email: prof.email,
      password: senha,
    });

    if (e2) {
      console.error("[login] erro ao autenticar", e2);
      return { ok: false, error: "Credenciais inválidas." };
    }

    // 3) Sucesso -> devolver redirect para o front
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
