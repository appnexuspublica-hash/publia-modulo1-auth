// src/app/governanca/GovernanceShell.tsx
"use client";

import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  FileSearch,
  FileText,
  Landmark,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";

import GovernanceHeader from "./components/GovernanceHeader";
import GovernanceSidebar from "./components/GovernanceSidebar";
import {
  getGovernanceFunctionalRoleLabel,
  getGovernanceHistoryRetentionPolicyLabel,
  getGovernanceMunicipalitySizeLabel,
  getGovernanceOrganizationTypeLabel,
  getGovernanceTechnicalRoleLabel,
  getOrganizationStatusLabel,
  type GovernanceContext,
} from "@/types/governance";

type GovernanceShellProps = {
  userLabel: string;
  userEmail: string | null;
  context: GovernanceContext | null;
};

function formatDate(value: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(date);
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 14) {
    return value || "Não informado";
  }

  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
}

function formatPopulation(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Não informado";
  }

  return `${new Intl.NumberFormat("pt-BR").format(value)} habitantes`;
}

function EmptyGovernanceAccess({ userLabel }: { userLabel: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5] text-slate-900">
      <GovernanceHeader
        userLabel={userLabel}
        organizationName="Governança não configurada"
        organizationStatusLabel="Sem organização"
      />

      <main className="flex flex-1 items-center justify-center px-6">
        <section className="w-full max-w-2xl rounded-3xl border border-[#dedede] bg-white p-8 shadow-sm">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
            <ShieldCheck size={28} />
          </div>

          <h1 className="text-2xl font-bold text-slate-950">
            Acesso ao Publ.IA Governança ainda não configurado
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Seu CPF está autenticado, mas ainda não foi vinculado a uma conta
            institucional ativa do Governança.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Para liberar o acesso, a Nexus ou o administrador do órgão deve
            vincular este usuário à organização correspondente.
          </div>
        </section>
      </main>
    </div>
  );
}

export default function GovernanceShell({
  userLabel,
  userEmail,
  context,
}: GovernanceShellProps) {
  if (!context) {
    return <EmptyGovernanceAccess userLabel={userLabel} />;
  }

  const { organization, membership } = context;

  const isAdminAreaEnabled = ["owner", "admin", "manager"].includes(
    membership.technical_role,
  );

  const overviewCards = [
    {
      title: "Usuários",
      description: "Gerencie membros, papéis funcionais e permissões técnicas.",
      icon: Users,
      value: organization.seats_limit
        ? `Até ${organization.seats_limit} assentos`
        : "Sem limite definido",
      href: "/governanca/usuarios",
      enabled: isAdminAreaEnabled,
    },
    {
      title: "Base institucional",
      description: "Documentos oficiais, normas, manuais e pareceres-modelo.",
      icon: BookOpen,
      value: "Documentos",
      href: "/governanca/base-institucional",
      enabled: isAdminAreaEnabled,
    },
    {
      title: "Fontes oficiais",
      description: "Sites, diários oficiais, portais e repositórios do órgão.",
      icon: FileSearch,
      value: "Curadoria",
      href: "/governanca/fontes-oficiais",
      enabled: isAdminAreaEnabled,
    },
    {
      title: "Chat Governança",
      description: "Acesso operacional à IA institucional do órgão.",
      icon: MessageSquare,
      value: "Acessar chat",
      href: "/governanca/chat",
      enabled: true,
    },
    {
      title: "Auditoria",
      description: "Acompanhe ações administrativas e uso institucional.",
      icon: ShieldCheck,
      value: "Histórico",
      href: "/governanca/auditoria",
      enabled: isAdminAreaEnabled,
    },
    {
      title: "Indicadores",
      description: "Uso por período, usuários ativos e atividade do chat.",
      icon: BarChart3,
      value: "Métricas",
      href: "/governanca/indicadores",
      enabled: isAdminAreaEnabled,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5] text-slate-900">
      <GovernanceHeader
        userLabel={userLabel}
        userEmail={userEmail}
        organizationName={organization.name}
        organizationStatusLabel={getOrganizationStatusLabel(organization.status)}
      />

      <div className="flex min-h-0 flex-1">
        <GovernanceSidebar
          organizationName={organization.name}
          functionalRoleLabel={getGovernanceFunctionalRoleLabel(
            membership.functional_role,
          )}
          technicalRoleLabel={getGovernanceTechnicalRoleLabel(
            membership.technical_role,
          )}
        />

        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
          <section className="mb-8 rounded-3xl border border-[#dedede] bg-white p-7 shadow-sm">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
                  <Landmark size={14} />
                  Painel administrativo do órgão
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                  {organization.name}
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Ambiente de gestão institucional do Publ.IA Governança. Aqui
                  ficam os dados do órgão, contrato, usuários, base
                  institucional, fontes oficiais, auditoria e indicadores.
                </p>
              </div>

              <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-[#0f3a4a]">
                  Conta institucional
                </p>
                <p className="mt-1">
                  <strong>CNPJ:</strong> {formatCnpj(organization.cnpj)}
                </p>
                <p className="mt-1">
                  <strong>Status:</strong>{" "}
                  {getOrganizationStatusLabel(organization.status)}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
                  <Building2 size={22} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Dados do órgão
                  </h2>
                  <p className="text-sm text-slate-600">
                    Cadastro institucional usado pela Nexus e pelo administrador
                    do órgão.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Nome jurídico
                  </span>
                  <strong className="mt-1 block text-slate-950">
                    {organization.legal_name || "Não informado"}
                  </strong>
                </div>

                <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Tipo do órgão
                  </span>
                  <strong className="mt-1 block text-slate-950">
                    {getGovernanceOrganizationTypeLabel(
                      organization.organization_type,
                    )}
                  </strong>
                </div>

                <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Município / UF
                  </span>
                  <strong className="mt-1 block text-slate-950">
                    {organization.municipality_name || "Não informado"}
                    {organization.state_uf ? `/${organization.state_uf}` : ""}
                  </strong>
                </div>

                <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Código IBGE
                  </span>
                  <strong className="mt-1 block text-slate-950">
                    {organization.ibge_code || "Não informado"}
                  </strong>
                </div>

                <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4 md:col-span-2">
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Porte do município
                  </span>
                  <strong className="mt-1 block text-slate-950">
                    {getGovernanceMunicipalitySizeLabel(
                      organization.municipality_size,
                    )}
                  </strong>
                </div>

                <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    População
                  </span>
                  <strong className="mt-1 block text-slate-950">
                    {formatPopulation(organization.population)}
                  </strong>
                </div>

                <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Região
                  </span>
                  <strong className="mt-1 block text-slate-950">
                    {organization.region || "Não informado"}
                  </strong>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
                  <CalendarDays size={22} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Contrato e retenção
                  </h2>
                  <p className="text-sm text-slate-600">
                    Regras comerciais e período de retenção do histórico.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Contrato
                  </span>
                  <strong className="mt-1 block text-slate-950">
                    {organization.contract_reference || "Não informado"}
                  </strong>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
                    <span className="block text-xs font-semibold uppercase text-slate-500">
                      Início
                    </span>
                    <strong className="mt-1 block text-slate-950">
                      {formatDate(organization.contract_starts_at)}
                    </strong>
                  </div>

                  <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
                    <span className="block text-xs font-semibold uppercase text-slate-500">
                      Fim
                    </span>
                    <strong className="mt-1 block text-slate-950">
                      {formatDate(organization.contract_ends_at)}
                    </strong>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4">
                  <span className="block text-xs font-semibold uppercase text-slate-500">
                    Retenção do histórico
                  </span>
                  <strong className="mt-1 block text-slate-950">
                    {getGovernanceHistoryRetentionPolicyLabel(
                      organization.history_retention_policy,
                    )}
                  </strong>
                </div>
              </div>
            </article>
          </section>

          <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {overviewCards.map((card) => {
              const Icon = card.icon;

              const content = (
                <article
                  className={[
                    "h-full rounded-3xl border bg-white p-5 shadow-sm transition",
                    card.enabled
                      ? "border-[#dedede] hover:border-[#bcbcbc] hover:shadow-md"
                      : "border-[#dedede] opacity-60",
                  ].join(" ")}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
                      <Icon size={22} />
                    </div>

                    <span className="rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-slate-700">
                      {card.value}
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-slate-950">
                    {card.title}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {card.description}
                  </p>
                </article>
              );

              if (!card.enabled) {
                return <div key={card.title}>{content}</div>;
              }

              return (
                <Link key={card.title} href={card.href}>
                  {content}
                </Link>
              );
            })}
          </section>

          <section className="mt-7 rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
                <FileText size={22} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Próxima etapa de configuração
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Com o cadastro institucional do órgão estruturado, os próximos
                  módulos serão gestão de usuários, base institucional e fontes
                  oficiais. O Chat Governança continua disponível como uso
                  operacional da IA, separado deste painel administrativo.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
