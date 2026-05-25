// src/app/governanca/login/GovernanceLoginForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export default function GovernanceLoginForm() {
  const router = useRouter();

  const [cnpj, setCnpj] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/governance/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cnpj: onlyDigits(cnpj),
          cpf: onlyDigits(cpf),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        setError(data?.error ?? "Não foi possível autenticar.");
        return;
      }

      router.push("/governanca");
      router.refresh();
    } catch {
      setError("Erro de conexão ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          CNPJ do órgão
        </label>

        <input
          type="text"
          value={cnpj}
          onChange={(event) => setCnpj(event.target.value)}
          placeholder="00.000.000/0000-00"
          className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 outline-none focus:border-[#0b4a55]"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          CPF do usuário
        </label>

        <input
          type="text"
          value={cpf}
          onChange={(event) => setCpf(event.target.value)}
          placeholder="000.000.000-00"
          className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 outline-none focus:border-[#0b4a55]"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Senha
        </label>

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Sua senha institucional"
          className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 outline-none focus:border-[#0b4a55]"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-[#0b4a55] px-4 py-3 font-semibold text-white transition hover:bg-[#083941] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar no Governança"}
      </button>
    </form>
  );
}
