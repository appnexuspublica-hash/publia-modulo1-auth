//src/app/(auth)/recuperar-senha/ResetForm.tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";

import AuthShell from "@/components/auth/AuthShell";
import AuthInput from "@/components/auth/AuthInput";
import Alert from "@/components/auth/Alert";

import { resetAction } from "./resetActions";

type ResetState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const initialState: ResetState = {
  ok: false,
  error: "",
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-[#0d4161] px-4 py-2 text-sm font-semibold uppercase text-white hover:opacity-95 disabled:opacity-60"
    >
      {pending ? "Atualizando..." : "Atualizar senha"}
    </button>
  );
}

export default function ResetForm() {
  const [state, formAction] = useFormState<ResetState, FormData>(
    resetAction,
    initialState
  );

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Informe seu CPF/CNPJ e defina uma nova senha de acesso."
    >
      <form action={formAction} className="mt-2 space-y-4">
        <AuthInput
          name="cpf_cnpj"
          label="CPF/CNPJ"
          placeholder="Digite seu CPF ou CNPJ"
          required
        />

        <AuthInput
          name="senha"
          label="Nova senha"
          type="password"
          placeholder="Digite a nova senha"
          required
        />

        <AuthInput
          name="confirm"
          label="Confirmar nova senha"
          type="password"
          placeholder="Repita a nova senha"
          required
        />

        <SubmitButton />

        {state.ok && !state.error && (
          <Alert type="success">
            {state.message || "Senha cadastrada com sucesso. Voce ja pode fazer login."}
          </Alert>
        )}

        {state.error && <Alert type="error">{state.error}</Alert>}
      </form>

      <div className="mt-4 text-center text-sm text-slate-700">
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          Voltar ao login
        </Link>
      </div>
    </AuthShell>
  );
}