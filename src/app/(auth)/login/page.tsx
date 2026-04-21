//src/app/(auth)/login/page.tsx
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

type SignupPlan = "essential" | "strategic";

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction] = useFormState<LoginState, FormData>(login, initialState);
  const [loadingPlan, setLoadingPlan] = React.useState<SignupPlan | null>(null);
  const [creatingAccount, setCreatingAccount] = React.useState(false);

  React.useEffect(() => {
    if (state?.ok && state?.redirect) {
      router.push(state.redirect);
    }
  }, [state, router]);

  async function handleCreateAccount(plan: SignupPlan) {
    try {
      setLoadingPlan(plan);
      setCreatingAccount(true);

      const r = await fetch("/api/signup-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const j = await r.json();

      if (!j?.ok || !j?.token) {
        alert("Falha ao abrir cadastro. Tente novamente.");
        return;
      }

      router.push(`/criar-conta?tk=${encodeURIComponent(j.token)}`);
    } catch {
      alert("Falha ao abrir cadastro. Tente novamente.");
    } finally {
      setLoadingPlan(null);
      setCreatingAccount(false);
    }
  }

  return (
    <AuthShell title="Publ.IA - Nexus Pública" subtitle="Faça login para acessar o painel.">
      {state?.error && <Alert type="error">{state.error}</Alert>}

      {state.ok && !state.error && (
        <Alert type="success">Login realizado com sucesso! Redirecionando...</Alert>
      )}

      {creatingAccount && (
        <Alert type="success">Preparando seu acesso ao Publ.IA...</Alert>
      )}

      <form action={formAction} className="mt-2 space-y-4">
        <AuthInput name="cpf_cnpj" label="CPF/CNPJ" placeholder="Digite seu CPF ou CNPJ" required />

        <AuthPasswordInput name="senha" label="Senha" placeholder="••••••••" required />

        <div className="flex justify-end -mt-1">
          <Link href="/recuperar-senha" className="text-xs text-blue-600 hover:underline">
            Esqueceu a senha?
          </Link>
        </div>

        <div className="pt-2">
          <SubmitButton>Entrar</SubmitButton>
        </div>
      </form>

      <div className="my-6 h-px w-full bg-slate-200" />

      <div className="rounded-2xl bg-[#8b8b8b] px-6 py-5 text-center shadow-sm">
        <div className="mb-2 text-[15px] font-extrabold uppercase text-white">
          Ainda não é cadastrado?
        </div>

        <div className="mb-3 text-xs text-white/90">
          Escolha um plano para testar gratuitamente
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleCreateAccount("essential")}
            disabled={loadingPlan !== null}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loadingPlan === "essential"
              ? "Gerando acesso..."
              : "Testar Publ.IA Essencial - 15 dias Grátis"}
          </button>

          <button
            type="button"
            onClick={() => handleCreateAccount("strategic")}
            disabled={loadingPlan !== null}
            className="w-full rounded-xl bg-[#2b4e67] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#244257] disabled:opacity-60"
          >
            {loadingPlan === "strategic"
              ? "Gerando acesso..."
              : "Testa Publ.IA Estratégico - 7 dias Grátis"}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
