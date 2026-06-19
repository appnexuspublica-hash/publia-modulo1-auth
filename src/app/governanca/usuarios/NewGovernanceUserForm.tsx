// src/app/governanca/usuarios/NewGovernanceUserForm.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";

import type {
  GovernanceFunctionalRole,
  GovernanceTechnicalRole,
} from "@/types/governance";

const functionalRoleOptions: Array<{
  value: GovernanceFunctionalRole;
  label: string;
}> = [
  { value: "administrador", label: "Administrador" },
  { value: "gestor", label: "Gestor" },
  { value: "controle_interno", label: "Controle Interno" },
  { value: "juridico", label: "Jurídico" },
  { value: "contabilidade", label: "Contabilidade" },
  { value: "licitacoes", label: "Licitações" },
  { value: "servidor", label: "Servidor" },
  { value: "consultor", label: "Consultor" },
  { value: "outro", label: "Outro" },
];

const technicalRoleOptions: Array<{
  value: GovernanceTechnicalRole;
  label: string;
}> = [
  { value: "admin", label: "Administrador técnico" },
  { value: "manager", label: "Gestor técnico" },
  { value: "member", label: "Membro" },
  { value: "viewer", label: "Leitor" },
];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpfInput(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;

  if (digits.length <= 6) {
    return digits.replace(/^(\d{3})(\d{1,3})$/, "$1.$2");
  }

  if (digits.length <= 9) {
    return digits.replace(/^(\d{3})(\d{3})(\d{1,3})$/, "$1.$2.$3");
  }

  return digits.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{1,2})$/,
    "$1.$2.$3-$4",
  );
}

export default function NewGovernanceUserForm() {
  const router = useRouter();

  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [functionalRole, setFunctionalRole] =
    useState<GovernanceFunctionalRole>("servidor");
  const [technicalRole, setTechnicalRole] =
    useState<GovernanceTechnicalRole>("member");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);

    const cpfDigits = onlyDigits(cpf);

    if (cpfDigits.length !== 11) {
      setErrorMessage("Informe um CPF válido com 11 dígitos.");
      return;
    }

    if (!nome.trim()) {
      setErrorMessage("Informe o nome do usuário.");
      return;
    }

    const emailValue = email.trim().toLowerCase();

    if (!emailValue || !emailValue.includes("@")) {
      setErrorMessage("Informe um e-mail válido.");
      return;
    }

    if (password.trim().length < 6) {
      setErrorMessage("A senha inicial deve ter pelo menos 6 caracteres.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/governance/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cpf: cpfDigits,
            nome: nome.trim(),
            email: emailValue,
            password: password.trim(),
            functionalRole,
            technicalRole,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível cadastrar.");
        }

        setSuccessMessage("Usuário cadastrado e vinculado ao órgão.");
        setCpf("");
        setNome("");
        setEmail("");
        setPassword("");
        setFunctionalRole("servidor");
        setTechnicalRole("member");

        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao cadastrar usuário.";

        setErrorMessage(message);
      }
    });
  }

  return (
    <section className="mb-7 rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
            <UserPlus size={14} />
            Novo usuário
          </div>

          <h2 className="text-lg font-bold text-slate-950">
            Cadastrar usuário do órgão
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            Informe CPF, nome, e-mail, senha inicial, papel funcional e
            permissão técnica. O acesso institucional será feito pelo CPF dentro
            do CNPJ do órgão, mantendo o e-mail real no cadastro.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 xl:grid-cols-6">
        <div className="xl:col-span-1">
          <label
            htmlFor="governance-user-cpf"
            className="text-xs font-semibold text-slate-700"
          >
            CPF
          </label>

          <input
            id="governance-user-cpf"
            value={cpf}
            onChange={(event) => setCpf(formatCpfInput(event.target.value))}
            placeholder="000.000.000-00"
            className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
          />
        </div>

        <div className="xl:col-span-1">
          <label
            htmlFor="governance-user-name"
            className="text-xs font-semibold text-slate-700"
          >
            Nome
          </label>

          <input
            id="governance-user-name"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Nome do usuário"
            className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
          />
        </div>

        <div className="xl:col-span-1">
          <label
            htmlFor="governance-user-email"
            className="text-xs font-semibold text-slate-700"
          >
            E-mail
          </label>

          <input
            id="governance-user-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@orgao.gov.br"
            className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
          />
        </div>

        <div className="xl:col-span-1">
          <label
            htmlFor="governance-user-password"
            className="text-xs font-semibold text-slate-700"
          >
            Senha inicial
          </label>

          <input
            id="governance-user-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
          />
        </div>

        <div className="xl:col-span-1">
          <label
            htmlFor="governance-user-functional-role"
            className="text-xs font-semibold text-slate-700"
          >
            Papel funcional
          </label>

          <select
            id="governance-user-functional-role"
            value={functionalRole}
            onChange={(event) =>
              setFunctionalRole(event.target.value as GovernanceFunctionalRole)
            }
            className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
          >
            {functionalRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-1">
          <label
            htmlFor="governance-user-technical-role"
            className="text-xs font-semibold text-slate-700"
          >
            Permissão técnica
          </label>

          <select
            id="governance-user-technical-role"
            value={technicalRole}
            onChange={(event) =>
              setTechnicalRole(event.target.value as GovernanceTechnicalRole)
            }
            className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
          >
            {technicalRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-6">
          {errorMessage && (
            <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f3a4a] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <UserPlus size={18} />
            )}
            Cadastrar usuário
          </button>
        </div>
      </form>
    </section>
  );
}