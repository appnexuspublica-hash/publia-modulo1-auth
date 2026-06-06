// src/app/governanca/components/GovernanceSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  FileSearch,
  Landmark,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

type GovernanceSidebarProps = {
  organizationName: string;
  functionalRoleLabel: string;
  technicalRoleLabel: string;
};

const navigationItems = [
  {
    label: "Visão geral",
    icon: Landmark,
    href: "/governanca",
    enabled: true,
  },
  {
    label: "Chat Governança",
    icon: MessageSquare,
    href: "/governanca/chat",
    enabled: true,
    alsoActiveWhen: ["/governanca/conversas"],
  },
  {
    label: "Usuários",
    icon: Users,
    href: "/governanca/usuarios",
    enabled: true,
  },
  {
    label: "Base institucional",
    icon: BookOpen,
    href: "/governanca/base-institucional",
    enabled: true,
  },
  {
    label: "Fontes oficiais",
    icon: FileSearch,
    href: "/governanca/fontes-oficiais",
    enabled: true,
  },
  {
    label: "Auditoria",
    icon: ShieldCheck,
    href: "/governanca/auditoria",
    enabled: true,
  },
  {
    label: "Indicadores",
    icon: BarChart3,
    href: "/governanca/indicadores",
    enabled: true,
  },
  {
    label: "Configurações",
    icon: Settings,
    href: "/governanca/configuracoes",
    enabled: false,
  },
];

export default function GovernanceSidebar({
  organizationName,
  functionalRoleLabel,
  technicalRoleLabel,
}: GovernanceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-80 shrink-0 border-r border-[#dedede] bg-[#e6e6e6] p-5 lg:flex lg:flex-col">
      <div className="rounded-3xl border border-[#dedede] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0f3a4a]">
          Órgão
        </p>

        <h2 className="mt-2 line-clamp-2 text-base font-bold text-slate-950">
          {organizationName}
        </h2>

        <div className="mt-4 space-y-2 text-xs">
          <div className="rounded-2xl bg-[#e6e6e6] p-3 text-[#0f3a4a]">
            <span className="block font-semibold">Papel funcional</span>
            <span>{functionalRoleLabel}</span>
          </div>

          <div className="rounded-2xl bg-[#f5f5f5] p-3 text-slate-800">
            <span className="block font-semibold">Permissão técnica</span>
            <span>{technicalRoleLabel}</span>
          </div>
        </div>
      </div>

      <nav className="mt-5 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/governanca" && pathname.startsWith(item.href)) ||
            Boolean(
              item.alsoActiveWhen?.some((activePath) =>
                pathname.startsWith(activePath),
              ),
            );

          if (!item.enabled) {
            return (
              <button
                key={item.label}
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-600 opacity-60 transition"
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={[
                "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition",
                isActive
                  ? "bg-[#0f3a4a] text-white shadow-sm"
                  : "text-slate-700 hover:bg-white hover:text-[#0f3a4a]",
              ].join(" ")}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-3xl border border-[#dedede] bg-white p-4 text-xs leading-5 text-slate-600 shadow-sm">
        <strong className="text-slate-950">Painel Governança</strong>
        <p className="mt-1">
          Gestão institucional do órgão, usuários autorizados e acesso ao Chat
          Governança.
        </p>
      </div>
    </aside>
  );
}
