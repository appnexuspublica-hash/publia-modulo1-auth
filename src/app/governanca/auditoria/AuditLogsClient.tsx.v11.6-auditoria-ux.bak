// src/app/governanca/auditoria/AuditLogsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Braces, Clock, Fingerprint, ShieldCheck, UserRound } from "lucide-react";

import type { GovernanceAuditLog } from "@/types/governance";

type AuditLogsClientProps = {
  organizationName: string;
  canViewAudit: boolean;
};

function formatDateTime(value: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function humanizeValue(value: string | null) {
  if (!value) return "Não informado";

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatMetadata(metadata: Record<string, unknown>) {
  try {
    return JSON.stringify(metadata ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function shortenUuid(value: string | null) {
  if (!value) return "Não informado";

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export default function AuditLogsClient({
  organizationName,
  canViewAudit,
}: AuditLogsClientProps) {
  const [logs, setLogs] = useState<GovernanceAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const todayLogsCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return logs.filter((log) => log.created_at.slice(0, 10) === today).length;
  }, [logs]);

  async function loadLogs() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/governance/audit-logs", {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível listar a auditoria.");
      }

      setLogs(data.logs ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível listar os registros de auditoria.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (canViewAudit) {
      loadLogs();
      return;
    }

    setIsLoading(false);
  }, [canViewAudit]);

  if (!canViewAudit) {
    return (
      <section className="rounded-3xl border border-[#dedede] bg-white p-7 shadow-sm">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
          <ShieldCheck size={28} />
        </div>

        <h1 className="text-2xl font-bold text-slate-950">
          Auditoria restrita
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Apenas usuários com permissão técnica de proprietário, administrador
          ou gestor podem consultar a auditoria institucional.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-[#dedede] bg-white p-7 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
              <ShieldCheck size={14} />
              Auditoria
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Auditoria institucional
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Consulte os eventos registrados no ambiente Governança de{" "}
              <strong>{organizationName}</strong>. Esta tela é somente leitura
              e respeita o isolamento por organização.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
            <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Eventos listados
              </p>
              <strong className="mt-1 block text-2xl text-slate-950">
                {logs.length}
              </strong>
            </div>

            <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Eventos hoje
              </p>
              <strong className="mt-1 block text-2xl text-slate-950">
                {todayLogsCount}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Registros recentes
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Últimos eventos gravados em organization_audit_logs.
            </p>
          </div>

          <button
            type="button"
            onClick={loadLogs}
            disabled={isLoading}
            className="rounded-2xl bg-[#0f3a4a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#164f63] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-[#dedede] bg-[#f8f8f8] p-8 text-center text-sm text-slate-600">
            Carregando registros de auditoria...
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dedede] bg-[#f8f8f8] p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
              <Activity size={24} />
            </div>

            <h3 className="text-base font-bold text-slate-950">
              Nenhum evento encontrado
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Quando ações institucionais forem registradas, elas aparecerão
              nesta área.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <article
                key={log.id}
                className="rounded-3xl border border-[#dedede] bg-[#f8f8f8] p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#0f3a4a] px-3 py-1 text-xs font-semibold text-white">
                        <Activity size={13} />
                        {humanizeValue(log.action)}
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        <Fingerprint size={13} />
                        {humanizeValue(log.entity_type)}
                      </span>
                    </div>

                    <div className="grid gap-3 text-sm md:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4">
                        <span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                          <Clock size={13} />
                          Data
                        </span>
                        <strong className="text-slate-950">
                          {formatDateTime(log.created_at)}
                        </strong>
                      </div>

                      <div className="rounded-2xl bg-white p-4">
                        <span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                          <UserRound size={13} />
                          Usuário
                        </span>
                        <strong className="text-slate-950">
                          {shortenUuid(log.actor_user_id)}
                        </strong>
                      </div>

                      <div className="rounded-2xl bg-white p-4">
                        <span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                          <Fingerprint size={13} />
                          Entidade
                        </span>
                        <strong className="text-slate-950">
                          {shortenUuid(log.entity_id)}
                        </strong>
                      </div>
                    </div>

                    <details className="mt-4 rounded-2xl bg-white p-4">
                      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#0f3a4a]">
                        <Braces size={15} />
                        Ver metadata
                      </summary>

                      <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                        {formatMetadata(log.metadata)}
                      </pre>
                    </details>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
