"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login, type LoginState } from "./loginActions";
import Image from "next/image";
import Link from "next/link";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useFormState<LoginState, FormData>(
    login,           // 👈 usa a mesma action do page.tsx
    { ok: false }
  );

  return (
    <div className="w-full max-w-md rounded-2xl border bg-gray-50 p-8 shadow-sm">
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col items-center">
        <Image
          src="https://nexuspublica.com.br/wp-content/uploads/2025/09/icon_nexus.png"
          alt="Publ.IA"
          width={40}
          height={40}
          className="mb-2"
        />

        <h1 className="text-lg font-semibold text-center">
          Publ.IA - Nexus Pública
        </h1>

        <p className="text-sm text-gray-600 text-center">
          Faça login para acessar o painel.
        </p>
      </div>

      {/* Mensagem de erro */}
      {state.error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Formulário */}
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
        <Link
          href="/recuperar-senha"
          className="text-sm font-medium text-blue-700 underline"
        >
          Esqueceu a senha?
        </Link>
      </div>
    </div>
  );
}
