// src/app/chat/components/ChatHeader.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

type ChatHeaderProps = {
  userLabel: string;
};

export function ChatHeader({ userLabel }: ChatHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between bg-white px-6 shadow">
      {/* Logo + título do app */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="relative h-10 w-10">
          <Image
            src="/logos/logo-publia.png" // <-- arquivo está em public/logos/logo-publia.png
            alt="Logo Publ.IA"
            fill
            className="object-contain rounded-full"
          />
        </div>

        {/* Texto ao lado da logo */}
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-slate-900">Publ.IA 1.5</span>
          <span className="text-xs text-slate-500">Nexus Pública</span>
        </div>
      </div>

      {/* Usuário + sair */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-slate-700">
          Usuário:{" "}
          <span className="font-semibold text-slate-900">{userLabel}</span>
        </span>

        {/* Ajuste o href se sua rota de logout for outra */}
        <Link
          href="/logout"
          className="text-xs font-semibold text-red-600 hover:text-red-700"
        >
          [ SAIR ]
        </Link>
      </div>
    </header>
  );
}
