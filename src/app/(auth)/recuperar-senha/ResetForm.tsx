// src/app/(auth)/recuperar-senha/ResetForm.tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import { resetAction } from "./resetActions";
import Image from "next/image";
import Link from "next/link";

// Tipo de estado retornado pela action de reset
type ResetState = {
  ok: boolean;
  error?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
    >
      {pending ? "Atualizando..." : "Atualizar senha"}
    </button>
  );
}

export default function ResetForm() {
  const [state, formAction] = useFormState<ResetState, FormData>(
    resetAction,
    { ok: false, error: "" }
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
          Atualize sua senha de acesso.
        </p>
      </div>

      {/* Sucesso */}
      {state.ok && !state.error && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 text-center">
          Senha atualizada com sucesso! Você já pode fazer login.
        </div>
      )}

      {/* Erro */}
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
            placeholder="Informe seu CPF ou CNPJ"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">Nova senha</label>
          <input
            type="password"
            name="senha"
            className="w-full rounded border px-3 py-2 outline-none focus:ring"
            placeholder="Nova senha"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">Confirmar nova senha</label>
          <input
            type="password"
            name="senha2"
            className="w-full rounded border px-3 py-2 outline-none focus:ring"
            placeholder="Repita a nova senha"
            required
          />
        </div>

        <SubmitButton />
      </form>

      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-sm font-medium text-blue-700 underline"
        >
          Voltar para login
        </Link>
      </div>
    </div>
  );
}
