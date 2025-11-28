"use client";

import * as React from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";

import AuthShell from "../../../components/auth/AuthShell";
import AuthInput from "../../../components/auth/AuthInput";
import SubmitButton from "../../../components/auth/SubmitButton";
import Alert from "../../../components/auth/Alert";
import AuthPasswordInput from "../../../components/auth/AuthPasswordInput";
import { login, type LoginState } from "./loginActions";

const initialState: LoginState = { ok: false };

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction] = useFormState<LoginState, FormData>(
    login,
    initialState
  );

  React.useEffect(() => {
    if (state?.ok && state?.redirect) {
      // redireciona assim que o login der certo
      router.push(state.redirect);
    }
  }, [state, router]);

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
    </AuthShell>
  );
}
