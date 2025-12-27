// src/app/(auth)/criar-conta/CriarContaPageClient.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormState } from "react-dom";

import AuthShell from "@/components/auth/AuthShell";
import AuthInput from "@/components/auth/AuthInput";
import SubmitButton from "@/components/auth/SubmitButton";
import Alert from "@/components/auth/Alert";
import AuthPasswordInput from "@/components/auth/AuthPasswordInput";
import { criarConta } from "./formActions";

type State = {
  ok: boolean;
  error?: string;
  redirect?: string;
};

const initialState: State = { ok: false };

export default function CriarContaPageClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const tk = sp.get("tk") ?? "";

  const [state, formAction] = useFormState<State, FormData>(
    criarConta as any,
    initialState
  );

  // Redireciona automaticamente depois do sucesso (opcional)
  React.useEffect(() => {
    if (state?.ok && state?.redirect) {
      const t = setTimeout(() => router.push(state.redirect!), 1500);
      return () => clearTimeout(t);
    }
  }, [state?.ok, state?.redirect, router]);

  const disabled = !!state?.ok;

  return (
    <AuthShell
      title="Publ.IA - Nexus Pública"
      subtitle="Crie sua conta para acessar o painel."
    >
      {/* Erro geral do cadastro */}
      {state.error && !state.ok && (
        <Alert type="error">{state.error}</Alert>
      )}

      <form action={formAction} className="mt-2 space-y-4">
        {/* token vindo da URL */}
        <input type="hidden" name="tk" value={tk} />

        {/* ORDEM E TEXTOS EXATOS */}

        <AuthInput
          name="cpf_cnpj"
          label="CPF / CNPJ"
          placeholder="Digite seu CPF ou CNPJ"
          disabled={disabled}
          required
        />

        <AuthInput
          name="nome"
          label="Nome ou Razão Social"
          placeholder="Seu nome completo ou razão social"
          disabled={disabled}
          required
        />

        <AuthInput
          name="email"
          type="email"
          label="E-mail"
          placeholder="Seu melhor e-mail"
          disabled={disabled}
          required
        />

        <AuthInput
          name="telefone"
          label="Telefone/WhatsApp"
          placeholder="(00) 00000-0000"
          disabled={disabled}
          required
        />

        <AuthInput
          name="cidade_uf"
          label="Cidade / UF"
          placeholder="Ex.: Santana do Itararé / PR"
          disabled={disabled}
          required
        />

        <AuthPasswordInput
          name="senha"
          label="Senha (mínimo 8 caracteres)"
          placeholder="Crie uma senha segura"
          disabled={disabled}
          minLength={8}
          required
        />

        <div className="pt-2">
          <SubmitButton disabled={disabled}>ENVIAR</SubmitButton>
        </div>

        {/* BLOCO DE SUCESSO: mensagem + botão FAZER LOGIN */}
        {state.ok && (
          <div className="mt-4 space-y-2">
            <Alert type="success">
              Conta criada com sucesso! Você já pode fazer LOGIN.
            </Alert>

            <div className="text-center">
              <Link
                href={state.redirect || "/login"}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                FAZER LOGIN
              </Link>
            </div>
          </div>
        )}
      </form>
    </AuthShell>
  );
}
