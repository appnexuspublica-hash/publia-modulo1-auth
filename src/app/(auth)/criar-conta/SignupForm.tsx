"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { criarConta, type SignUpState } from "./formActions";

import AuthInput from "../../../components/auth/AuthInput";
import AuthPasswordInput from "../../../components/auth/AuthPasswordInput";
import SubmitButton from "../../../components/auth/SubmitButton";
import Alert from "../../../components/auth/Alert";

const initialState: SignUpState = { ok: false };

type Props = {
  token: string;
  tokenOk: boolean;
};

export default function SignupForm({ token, tokenOk }: Props) {
  const [state, formAction] = useFormState<SignUpState, FormData>(
    criarConta,
    initialState
  );

  // Se a action retornar redirect, faz o redirecionamento no client
  useEffect(() => {
    if (state?.ok && state.redirect) {
      window.location.href = state.redirect;
    }
  }, [state]);

  const blocked = !tokenOk;

  return (
    <form action={formAction} className="space-y-4">
      {/* Token vem da URL e é enviado escondido para a server action */}
      <input type="hidden" name="tk" value={token} />

      {/* Token inválido (verificado no server e no client) */}
      {!tokenOk && (
        <Alert
          variant="error"
          title="Cadastro bloqueado. Token inválido."
          message="Use o link oficial enviado pela Nexus Pública para criar sua conta."
        />
      )}

      {/* Erro retornado pela server action (quando o token é válido) */}
      {state?.error && tokenOk && (
        <Alert variant="error" title={state.error ?? "Erro ao cadastrar."} />
      )}

      {/* CPF/CNPJ */}
      <AuthInput
        name="cpf_cnpj"
        label="CPF/CNPJ"
        placeholder="Digite seu CPF ou CNPJ"
        required
        disabled={blocked}
      />

      {/* Nome / Razão Social */}
      <AuthInput
        name="nome"
        label="Nome / Razão Social"
        placeholder="Seu nome completo"
        required
        disabled={blocked}
      />

      {/* E-mail */}
      <AuthInput
        name="email"
        type="email"
        label="E-mail"
        placeholder="seuemail@exemplo.com"
        required
        disabled={blocked}
      />

      {/* Telefone */}
      <AuthInput
        name="telefone"
        label="Telefone (WhatsApp)"
        placeholder="(00) 99999-0000"
        required
        disabled={blocked}
      />

      {/* Cidade/UF */}
      <AuthInput
        name="cidade_uf"
        label="Cidade/UF"
        placeholder="Santana do Itararé/PR"
        required
        disabled={blocked}
      />

      {/* Senha */}
      <AuthPasswordInput
        name="senha"
        label="Senha (mínimo 8)"
        placeholder="Digite uma senha segura"
        required
        disabled={blocked}
      />

      <div className="pt-2">
        <SubmitButton disabled={blocked}>Criar conta</SubmitButton>
      </div>
    </form>
  );
}
