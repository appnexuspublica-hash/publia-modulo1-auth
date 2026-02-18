// src/app/chat/components/ChatEmptyState.tsx

"use client";

export function ChatEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white">
      <p className="max-w-3xl text-sm">
        Sou <span className="font-semibold">Publ.IA</span>, Inteligência Artificial
        especializada em Gestão Pública, Licitações e Contratos. <br />
        Atuo para fortalecer a eficiência, a transparência e a segurança jurídica na
        Administração Pública Municipal.
      </p>

      <h2 className="mt-6 text-xl font-semibold">Como posso ajudar você?</h2>
    </div>
  );
}

