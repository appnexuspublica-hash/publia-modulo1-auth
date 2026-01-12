"use client";

import * as React from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";

import AuthShell from "@/components/auth/AuthShell";
import AuthInput from "@/components/auth/AuthInput";
import SubmitButton from "@/components/auth/SubmitButton";
import Alert from "@/components/auth/Alert";
import AuthPasswordInput from "@/components/auth/AuthPasswordInput";
import { login, type LoginState } from "./loginActions";

const initialState: LoginState = { ok: false };

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction] = useFormState<LoginState, FormData>(
    login,
    initialState
  );

  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    if (state?.ok && state?.redirect) {
      router.push(state.redirect);
    }
  }, [state, router]);

  async function handleCreateAccount() {
    try {
      setCreating(true);

      const r = await fetch("/api/signup-token", { method: "POST" });
      const j = await r.json();

      if (!j?.ok || !j?.token) {
        alert("Falha ao abrir cadastro. Tente novamente.");
        return;
      }

      router.push(`/criar-conta?tk=${encodeURIComponent(j.token)}`);
    } catch (e) {
      alert("Falha ao abrir cadastro. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AuthShell
      title="Publ.IA - Nexus Pública"
      subtitle="Faça login para acessar o painel."
    >
      {state?.error && <Alert type="error">{state.error}</Alert>}

      {state.ok && !state.error && (
        <Alert type="success">
          Login realizado com sucesso! Redirecionando para o painel…
        </Alert>
      )}

      <form action={formAction} className="mt-2 space-y-4">
        <AuthInput
          name="cpf_cnpj"
          label="CPF/CNPJ"
          placeholder="Digite seu CPF ou CNPJ"
          required
        />

        <AuthPasswordInput
          name="senha"
          label="Senha"
          placeholder="••••••••"
          required
        />

        <div className="flex justify-end -mt-1">
          <Link
            href="/recuperar-senha"
            className="text-xs text-blue-600 hover:underline"
          >
            Esqueceu a senha?
          </Link>
        </div>

        <div className="pt-2">
          <SubmitButton>Entrar</SubmitButton>
        </div>
      </form>

      {/* ✅ DIVISÓRIA entre Entrar e Criar Conta */}
      <div className="my-6 h-px w-full bg-slate-200" />

      {/* BLOCO: ainda não é cadastrado? */}
      <div className="text-center">
        <div className="text-[15px] font-bold text-slate-800">
          Ainda não é cadastrado?
        </div>

        <button
          type="button"
          onClick={handleCreateAccount}
          disabled={creating}
          className="mt-3 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-[13px] font-extrabold uppercase tracking-wide text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {creating ? "ABRINDO CADASTRO..." : "CRIAR CONTA AGORA"}
        </button>
      </div>
    </AuthShell>
  );
}
