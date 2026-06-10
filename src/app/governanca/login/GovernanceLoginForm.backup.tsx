// src/app/governanca/login/GovernanceLoginForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

type LoginResponse = {
  ok?: boolean;
  error?: string;
  email?: string;
  redirectTo?: string;
};

export default function GovernanceLoginForm() {
  const router = useRouter();

  const [cnpj, setCnpj] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/governance/auth/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cnpj: onlyDigits(cnpj),
          cpf: onlyDigits(cpf),
          password,
        }),
      });

      const data = (await response.json()) as LoginResponse;

      if (!response.ok || !data?.ok) {
        setError(data?.error ?? "Não foi possível autenticar.");
        return;
      }

      if (!data.email) {
        setError("Login validado, mas o e-mail do usuário não foi retornado.");
        return;
      }

      const supabase = createSupabaseBrowserClient();

      await supabase.auth.signOut({ scope: "local" });

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password,
      });

      if (signInError) {
        console.error("[GovernanceLoginForm] signInWithPassword error:", signInError);
        setError("CPF/CNPJ ou senha inválidos.");
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("[GovernanceLoginForm] getSession error:", sessionError);
        setError("Login validado, mas a sessão não foi salva no navegador.");
        return;
      }

      router.replace(data.redirectTo ?? "/governanca");
      router.refresh();
    } catch (loginError) {
      console.error("[GovernanceLoginForm] login error:", loginError);
      setError("Erro de conexão ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          CNPJ do órgão
        </label>

        <input
          type="text"
          value={cnpj}
          onChange={(event) => setCnpj(event.target.value)}
          placeholder="00.000.000/0000-00"
          className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 outline-none focus:border-[#0b4a55]"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          CPF do usuário
        </label>

        <input
          type="text"
          value={cpf}
          onChange={(event) => setCpf(event.target.value)}
          placeholder="000.000.000-00"
          className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 outline-none focus:border-[#0b4a55]"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Senha
        </label>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha institucional"
            className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 pr-12 outline-none focus:border-[#0b4a55]"
          />

          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Ocultar senha" : "Visualizar senha"}
            title={showPassword ? "Ocultar senha" : "Visualizar senha"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-[#0b4a55] focus:outline-none"
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M3 3l18 18" />
                <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                <path d="M9.88 4.24A10.61 10.61 0 0 1 12 4c7 0 10 8 10 8a17.42 17.42 0 0 1-3.1 4.45" />
                <path d="M6.61 6.61C3.8 8.5 2 12 2 12s3 8 10 8a10.85 10.85 0 0 0 5.39-1.39" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-[#0b4a55] px-4 py-3 font-semibold text-white transition hover:bg-[#083941] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar no Governança"}
      </button>
    </form>
  );
}
