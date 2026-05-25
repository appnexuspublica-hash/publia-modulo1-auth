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

export default function GovernanceHeader({
  userLabel,
  userEmail = null,
  organizationName,
  organizationStatusLabel,
}: GovernanceHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-[#dedede] bg-white px-6 shadow-sm">
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
            {organizationName} · {organizationStatusLabel}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-4 text-xs">
        <div className="hidden min-w-0 flex-col text-right sm:flex">
          <span className="truncate font-semibold text-slate-900">
            {userLabel}
          </span>

          {userEmail && (
            <span className="truncate text-slate-500">{userEmail}</span>
          )}
        </div>

        <Link
          href="/logout"
          className="rounded-full border border-red-100 px-3 py-1.5 font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700"
        >
          SAIR
        </Link>
      </div>
    </header>
  );
}