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

function formatUserLabel(value: string): { label: "Usuário"; value: string } {
  return {
    label: "Usuário",
    value: String(value ?? "").trim(),
  };
}

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

  const userDisplay = formatUserLabel(userLabel);

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

      <div className="flex min-w-0 items-center gap-4 text-xs">
        <span className="min-w-0 max-w-[320px] truncate text-slate-700">
          {userDisplay.label}:{" "}
          <span className="font-semibold text-slate-900">
            {userDisplay.value}
          </span>{" "}
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