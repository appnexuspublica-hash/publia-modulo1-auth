//src/app/(auth)/login/LoginForm.tsx
"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { login, type LoginState } from "./loginActions";
import Image from "next/image";
import Link from "next/link";

type SignupPlan = "essential" | "strategic";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

type SignupActionButtonProps = {
  plan: SignupPlan;
  label: string;
  helper: string;
  onClick: (plan: SignupPlan) => Promise<void>;
  loadingPlan: SignupPlan | null;
};

function SignupActionButton({
  plan,
  label,
  helper,
  onClick,
  loadingPlan,
}: SignupActionButtonProps) {
  const loading = loadingPlan === plan;

  const className =
    plan === "strategic"
      ? "w-full rounded-xl border border-purple-300 bg-gradient-to-r from-purple-50 to-fuchsia-50 px-4 py-3 text-left shadow-sm transition hover:shadow-md hover:border-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
      : "w-full rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-3 text-left shadow-sm transition hover:shadow-md hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60";

  const badgeClassName =
    plan === "strategic"
      ? "inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-purple-700"
      : "inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700";

  return (
    <button
      type="button"
      onClick={() => void onClick(plan)}
      disabled={loadingPlan !== null}
      className={className}
    >
      <div className="mb-2">
        <span className={badgeClassName}>
          {plan === "strategic" ? "Plano Estratégico" : "Plano Essencial"}
        </span>
      </div>

      <div className="font-semibold text-gray-900">
        {loading ? "Gerando link..." : label}
      </div>

      <div className="mt-1 text-sm text-gray-700">{helper}</div>
    </button>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const [state, formAction] = useFormState<LoginState, FormData>(login, { ok: false });
  const [signupError, setSignupError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<SignupPlan | null>(null);

  async function handleSignupRedirect(plan: SignupPlan) {
    try {
      setSignupError(null);
      setLoadingPlan(plan);

      const response = await fetch("/api/signup-token", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });

      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; token?: string; error?: string }
        | null;

      if (!response.ok || !data?.token) {
        setSignupError(data?.error || "Não foi possível gerar o link de cadastro.");
        return;
      }

      router.push(`/criar-conta?tk=${encodeURIComponent(data.token)}`);
    } catch (error) {
      console.error("[login] erro ao gerar signup token", error);
      setSignupError("Não foi possível gerar o link de cadastro.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border bg-gray-50 p-8 shadow-sm">
      <div className="mb-6 flex flex-col items-center">
        <Image
          src="https://nexuspublica.com.br/wp-content/uploads/2025/09/icon_nexus.png"
          alt="Publ.IA"
          width={40}
          height={40}
          className="mb-2"
        />

        <h1 className="text-center text-lg font-semibold">Publ.IA - Nexus Pública</h1>

        <p className="text-center text-sm text-gray-600">
          Faça login para acessar o painel.
        </p>
      </div>

      {state.error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {signupError && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {signupError}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm">CPF/CNPJ</label>
          <input
            name="cpf_cnpj"
            className="w-full rounded border px-3 py-2 outline-none focus:ring"
            placeholder="Digite seu CPF ou CNPJ"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">Senha</label>
          <input
            type="password"
            name="senha"
            className="w-full rounded border px-3 py-2 outline-none focus:ring"
            placeholder="Sua senha"
            required
          />
        </div>

        <SubmitButton />
      </form>

      <div className="mt-4 text-center">
        <Link href="/recuperar-senha" className="text-sm font-medium text-blue-700 underline">
          Esqueceu a senha?
        </Link>
      </div>

      <div className="my-6 h-px bg-gray-200" />

      <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-4">
        <p className="mb-3 text-center text-sm font-semibold text-gray-800">
          Ainda não tem conta?
        </p>

        <div className="space-y-3">
          <SignupActionButton
            plan="essential"
            label="Criar conta Essencial"
            helper="Acesso trial por 15 dias."
            onClick={handleSignupRedirect}
            loadingPlan={loadingPlan}
          />

          <SignupActionButton
            plan="strategic"
            label="Testar Estratégico"
            helper="Acesso trial por 7 dias."
            onClick={handleSignupRedirect}
            loadingPlan={loadingPlan}
          />
        </div>
      </div>
    </div>
  );
}
