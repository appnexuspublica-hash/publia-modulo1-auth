"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import AuthShell from "@/components/auth/AuthShell";
import AuthInput from "@/components/auth/AuthInput";
import SubmitButton from "@/components/auth/SubmitButton";
import Alert from "@/components/auth/Alert";
import AuthPasswordInput from "@/components/auth/AuthPasswordInput";
import { resetAction } from "./resetActions";

type State = { ok?: boolean; error?: string; message?: string };

export default function RecuperarSenhaPage() {
  const [state, formAction] = useFormState<State, FormData>(resetAction as any, { ok: false });

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Informe seu CPF/CNPJ e defina uma nova senha."
    >
      {!state?.ok && state?.error ? <Alert type="error">{state.error}</Alert> : null}
      {state?.ok && state?.message ? <Alert type="success">{state.message}</Alert> : null}

      <form action={formAction} className="mt-2 space-y-4">
        <AuthInput
          name="cpf_cnpj"
          label="CPF/CNPJ"
          placeholder="Digite seu CPF ou CNPJ"
          required
        />

        <AuthPasswordInput
          name="senha"
          label="Nova senha (mínimo 8)"
          placeholder="••••••••"
          required
          minLength={8}
        />

        <AuthPasswordInput
          name="confirm"
          label="Confirmar nova senha"
          placeholder="••••••••"
          required
          minLength={8}
        />

        {!state?.ok ? (
          <div className="pt-2 flex items-center justify-end">
            <SubmitButton>CADASTRAR NOVA SENHA</SubmitButton>
          </div>
        ) : (
          <div className="pt-2 text-center">
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              FAZER LOGIN
            </a>
          </div>
        )}
      </form>
    </AuthShell>
  );
}
