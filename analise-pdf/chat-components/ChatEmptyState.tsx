//src/app/chat/components/ChatEmptyState.tsx
"use client";

import { getChatTheme } from "@/app/chat/theme";

type ChatEmptyStateProps = {
  isStrategic?: boolean;
};

export function ChatEmptyState({
  isStrategic = false,
}: ChatEmptyStateProps) {
  const theme = getChatTheme(isStrategic);

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p
        className="max-w-3xl text-sm leading-relaxed"
        style={{ color: theme.colors.textMuted }}
      >
        Sou{" "}
        <span
          className="font-semibold"
          style={{ color: theme.colors.text }}
        >
          Publ.IA
        </span>
        , Inteligência Artificial especializada em Gestão Pública, Licitações e
        Contratos. <br />
        Atuo para fortalecer a eficiência, a transparência e a segurança
        jurídica na Administração Pública Municipal.
      </p>

      <h2
        className="mt-6 text-xl font-semibold"
        style={{ color: theme.colors.text }}
      >
        Como posso ajudar você?
      </h2>
    </div>
  );
}