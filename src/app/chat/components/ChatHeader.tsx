// src/app/chat/components/ChatHeader.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

type ChatHeaderProps = {
  userLabel: string;
  statusLabel?: string | null;
  productLabel?: string;
  versionLabel?: string;
  vendorLabel?: string;
};

export function ChatHeader({
  userLabel,
  statusLabel = null,
  productLabel = "Publ.IA ESSENCIAL",
  versionLabel = "1.7",
  vendorLabel = "Nexus Pública",
}: ChatHeaderProps) {
  const normalizedStatusLabel =
    typeof statusLabel === "string" && statusLabel.trim().length > 0
      ? statusLabel.trim()
      : null;

  return (
    <header className="flex h-16 items-center justify-between bg-white px-6 shadow">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10">
          <Image
            src="/logos/logo-publia.png"
            alt="Logo Publ.IA"
            fill
            className="rounded-full object-contain"
          />
        </div>

        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-slate-900">
            {productLabel} {versionLabel}
          </span>
          <span className="text-xs text-slate-500">{vendorLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span className="text-slate-700">
          Usuário: <span className="font-semibold text-slate-900">{userLabel}</span>{" "}
          {normalizedStatusLabel && (
            <span className="font-semibold text-slate-700">
              [{normalizedStatusLabel}]
            </span>
          )}
        </span>

        <Link href="/logout" className="text-xs font-semibold text-red-600 hover:text-red-700">
          [ SAIR ]
        </Link>
      </div>
    </header>
  );
}