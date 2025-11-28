// src/components/auth/Alert.tsx
"use client";

import { ReactNode } from "react";

type AlertKind = "error" | "success";

type AlertProps = {
  /** Usado nas telas antigas: <Alert type="error">...</Alert> */
  type?: AlertKind;
  /** Usado nas telas novas: <Alert variant="error" title="..." message="..." /> */
  variant?: AlertKind;
  /** Título opcional (para uso com variant/title/message) */
  title?: string;
  /** Mensagem opcional (para uso com variant/title/message) */
  message?: string;
  /** Conteúdo livre (modo antigo) */
  children?: ReactNode;
};

export function Alert({
  type,
  variant,
  title,
  message,
  children,
}: AlertProps) {
  // Normaliza o tipo: prioridade para "type", depois "variant"
  const kind: AlertKind = type ?? variant ?? "error";

  const isError = kind === "error";
  const bgClass = isError ? "bg-red-50" : "bg-emerald-50";
  const borderClass = isError ? "border-red-200" : "border-emerald-200";
  const textClass = isError ? "text-red-800" : "text-emerald-800";

  const hasStructuredContent = title || message;

  return (
    <div
      className={`mb-3 rounded-md border px-3 py-2 text-sm ${bgClass} ${borderClass} ${textClass}`}
      role={isError ? "alert" : "status"}
    >
      {hasStructuredContent ? (
        <div className="space-y-1">
          {title && (
            <div className="font-semibold leading-snug">
              {title}
            </div>
          )}
          {message && (
            <div className="leading-snug text-xs sm:text-sm">
              {message}
            </div>
          )}
        </div>
      ) : (
        // Modo antigo: conteúdo vem em children
        <div className="leading-snug text-xs sm:text-sm">
          {children}
        </div>
      )}
    </div>
  );
}

export default Alert;
