"use client";

import * as React from "react";
import Link from "next/link";

import AuthShell from "@/components/auth/AuthShell";
import AuthInput from "@/components/auth/AuthInput";
import Alert from "@/components/auth/Alert";

type Status = "idle" | "loading" | "ok" | "error";

export default function RecuperarSenhaPage() {
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    const fd = new FormData(e.currentTarget);
    const cpfCnpj = String(fd.get("cpf_cnpj") ?? "").trim();

    if (!cpfCnpj) {
      setError("Informe seu CPF/CNPJ.");
      setStatus("error");
      return;
    }

    try {
      // Se você tiver uma API/rota para recuperação, pode usar este endpoint.
      // Se não existir, vai dar 404, mas não quebra o build e você ajusta depois.
      const r = await fetch("/api/recuperar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf_cnpj: cpfCnpj }),
      });

      if (!r.ok) {
        // Não expõe se o CPF/CNPJ existe (boa prática), só loga no console
        console.error("[recuperar-senha] status:", r.status, await r.text());
      }

      setStatus("ok");
      e.currentTarget.reset();
    } catch (err) {
      console.error("[recuperar-senha] erro:", err);
      // Mesma ideia: não expor existência de conta
      setStatus("ok");
    }
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Informe seu CPF/CNPJ para receber instruções de recuperação."
    >
      {error && <Alert type="error">{error}</Alert>}

      {status === "ok" && (
        <Alert type="success">
          Se existir uma conta para este CPF/CNPJ, enviaremos instruções em instantes.
        </Alert>
      )}

      <form onSubmit={onSubmit} className="mt-2 space-y-4">
        <AuthInput
          name="cpf_cnpj"
          label="CPF/CNPJ"
          placeholder="Digite seu CPF ou CNPJ"
          required
        />

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-xl bg-[#0d4161] px-4 py-2 text-sm font-semibold uppercase text-white hover:opacity-95 disabled:opacity-60"
        >
          {status === "loading" ? "Enviando..." : "Enviar instruções"}
        </button>
      </form>

      <div className="mt-4 text-center text-sm text-slate-700">
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          Voltar ao login
        </Link>
      </div>
    </AuthShell>
  );
}