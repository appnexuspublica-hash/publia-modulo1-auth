"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  FileSearch,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { GovernanceIndicators } from "@/types/governance";

type LoadState = "idle" | "loading" | "success" | "error";

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: typeof Users;
}) {
  return (
    <article className="rounded-3xl border border-[#dedede] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
          <Icon size={22} />
        </div>
      </div>

      <p className="text-sm font-semibold text-slate-600">{title}</p>

      <strong className="mt-2 block text-3xl font-bold tracking-tight text-slate-950">
        {typeof value === "number" ? formatNumber(value) : value}
      </strong>

      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
        <Icon size={20} />
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </div>
  );
}

export default function IndicatorsClient() {
  const [state, setState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<GovernanceIndicators | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    async function loadIndicators() {
      setState("loading");
      setErrorMessage(null);

      try {
        const response = await fetch("/api/governance/indicators", {
          method: "GET",
          cache: "no-store",
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error ?? "Não foi possível carregar os indicadores.",
          );
        }

        if (isMounted) {
          setIndicators(payload.indicators);
          setState("success");
        }
      } catch (error) {
        if (isMounted) {
          setState("error");
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os indicadores.",
          );
        }
      }
    }

    loadIndicators();

    return () => {
      isMounted = false;
    };
  }, []);

  const seatsUsageLabel = useMemo(() => {
    if (!indicators) return "Não informado";

    const limit = indicators.users.seats_limit;

    if (!limit) {
      return `${formatNumber(indicators.users.seats_used)} usados`;
    }

    return `${formatNumber(indicators.users.seats_used)} de ${formatNumber(
      limit,
    )}`;
  }, [indicators]);

  return (
    <div className="text-slate-900">
      <section className="mb-7 rounded-3xl border border-[#dedede] bg-white p-7 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
              <BarChart3 size={14} />
              Indicadores
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Indicadores institucionais
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Acompanhe os principais números do Publ.IA Governança na
              organização atual. Todos os dados são filtrados pelo
              organization_id do órgão autenticado.
            </p>
          </div>

          <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-5 py-4 text-sm text-slate-700">
            <p className="font-semibold text-[#0f3a4a]">Organização</p>
            <p className="mt-1">
              {indicators?.organization.name ?? "Carregando..."}
            </p>
          </div>
        </div>
      </section>

      {state === "loading" && (
        <section className="rounded-3xl border border-[#dedede] bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 animate-spin text-[#0f3a4a]" />
          <p className="text-sm font-semibold text-slate-700">
            Carregando indicadores...
          </p>
        </section>
      )}

      {state === "error" && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm">
          {errorMessage}
        </section>
      )}

      {state === "success" && indicators && (
        <div className="space-y-7">
          <section className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
            <SectionHeader
              icon={Users}
              title="Usuários e assentos"
              description="Visão geral dos membros vinculados ao órgão."
            />

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={Users}
                title="Usuários totais"
                value={indicators.users.total}
                description="Total de vínculos cadastrados na organização."
              />

              <MetricCard
                icon={Activity}
                title="Usuários ativos"
                value={indicators.users.active}
                description="Membros ativos com acesso institucional."
              />

              <MetricCard
                icon={ShieldCheck}
                title="Usuários suspensos"
                value={indicators.users.suspended}
                description="Membros temporariamente sem acesso."
              />

              <MetricCard
                icon={Users}
                title="Assentos utilizados"
                value={seatsUsageLabel}
                description="Comparação entre assentos ativos e limite do contrato."
              />
            </div>
          </section>

          <section className="grid gap-7 xl:grid-cols-2">
            <article className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
              <SectionHeader
                icon={MessageSquare}
                title="Chat Governança"
                description="Uso geral das conversas institucionais."
              />

              <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <MetricCard
                  icon={MessageSquare}
                  title="Conversas"
                  value={indicators.chat.conversations_total}
                  description="Total de conversas criadas."
                />

                <MetricCard
                  icon={Activity}
                  title="Conversas ativas"
                  value={indicators.chat.conversations_active}
                  description="Conversas com status ativo."
                />

                <MetricCard
                  icon={MessageSquare}
                  title="Mensagens"
                  value={indicators.chat.messages_total}
                  description="Total de mensagens registradas."
                />
              </div>
            </article>

            <article className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
              <SectionHeader
                icon={BookOpen}
                title="Base Institucional"
                description="Documentos cadastrados para uso futuro do RAG institucional."
              />

              <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <MetricCard
                  icon={BookOpen}
                  title="Documentos"
                  value={indicators.institutional_documents.total}
                  description="Total de documentos institucionais."
                />

                <MetricCard
                  icon={Activity}
                  title="Indexados"
                  value={indicators.institutional_documents.indexed}
                  description="Documentos já marcados como indexados."
                />

                <MetricCard
                  icon={Loader2}
                  title="Pendentes"
                  value={indicators.institutional_documents.pending_indexing}
                  description="Documentos aguardando ou em processamento."
                />
              </div>
            </article>
          </section>

          <section className="grid gap-7 xl:grid-cols-2">
            <article className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
              <SectionHeader
                icon={FileSearch}
                title="Fontes Oficiais"
                description="Fontes cadastradas para curadoria institucional."
              />

              <div className="grid gap-5 md:grid-cols-2">
                <MetricCard
                  icon={FileSearch}
                  title="Fontes cadastradas"
                  value={indicators.official_sources.total}
                  description="Total de fontes oficiais registradas."
                />

                <MetricCard
                  icon={Activity}
                  title="Fontes ativas"
                  value={indicators.official_sources.active}
                  description="Fontes oficiais marcadas como ativas."
                />
              </div>
            </article>

            <article className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
              <SectionHeader
                icon={ShieldCheck}
                title="Auditoria"
                description="Eventos institucionais registrados pelo sistema."
              />

              <div className="grid gap-5 md:grid-cols-2">
                <MetricCard
                  icon={ShieldCheck}
                  title="Eventos totais"
                  value={indicators.audit.events_total}
                  description="Total de eventos de auditoria."
                />

                <MetricCard
                  icon={Activity}
                  title="Últimos 30 dias"
                  value={indicators.audit.events_last_30_days}
                  description="Eventos registrados no período recente."
                />
              </div>
            </article>
          </section>
        </div>
      )}
    </div>
  );
}
