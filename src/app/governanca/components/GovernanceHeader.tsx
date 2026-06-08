// src/app/governanca/components/GovernanceHeader.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

type GovernanceHeaderProps = {
  userLabel: string;
  userEmail?: string | null;
  organizationName: string;
  organizationStatusLabel: string;
};

async function handleLogout() {
  try {
    await fetch("/logout", {
      method: "POST",
      cache: "no-store",
    });
  } finally {
    window.location.href = "/governanca/login";
  }
}

export default function GovernanceHeader({
  userLabel,
  organizationName,
  organizationStatusLabel,
}: GovernanceHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-[#dedede] bg-white px-6 shadow-sm">
      <div className="flex min-w-0 items-center gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-10 w-10 shrink-0">
            <Image
              src="/logos/logo-publia.png"
              alt="Logo Publ.IA"
              fill
              className="rounded-full object-contain"
            />
          </div>

          <div className="min-w-0 leading-tight">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-bold text-[#0f3a4a]">
                Publ.IA GOVERNANÇA
              </span>

              <span className="rounded-full bg-[#e6e6e6] px-2 py-0.5 text-[11px] font-semibold text-[#0f3a4a]">
                3.0
              </span>
            </div>

            <span className="block truncate text-xs text-slate-500">
              {organizationName}
            </span>
          </div>
        </div>

        <Link
          href="/governanca"
          className="hidden shrink-0 items-center gap-2 rounded-full border border-[#dedede] bg-white px-4 py-2 text-xs font-semibold text-[#0f3a4a] transition hover:bg-slate-50 md:inline-flex"
          title="Abrir status institucional"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" />

          <span>Status institucional</span>

          <span className="font-medium text-slate-500">
            {organizationStatusLabel}
          </span>
        </Link>
      </div>

      <div className="flex min-w-0 items-center gap-4 text-xs">
        <div className="hidden min-w-0 flex-col text-right sm:flex">
          <span className="truncate font-semibold text-slate-900">
            {userLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-[#0f8a5f] bg-[#0f8a5f] px-3 py-1.5 font-semibold text-white transition hover:border-[#0b6f4c] hover:bg-[#0b6f4c]"
        >
          SAIR
        </button>
      </div>
    </header>
  );
}
