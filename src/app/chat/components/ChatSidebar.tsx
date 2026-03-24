//src/app/chat/components/ChatSidebar.tsx
"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { getSidebarAccessCta } from "@/lib/access-cta";
import type { FrontendAccessSummary } from "@/lib/access-client";

type ConversationItem = {
  id: string;
  title: string | null;
  created_at: string;
  is_shared?: boolean;
  share_id?: string | null;
};

type BlockedCta = {
  href: string;
  label: string;
} | null;

type ChatSidebarProps = {
  conversations: ConversationItem[];
  activeConversationId: string | null;
  onNewConversation: () => void | Promise<void>;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  userLabel: string;
  isBlocked?: boolean;
  blockedMessage?: string;
  blockedCta?: BlockedCta;
  access?: FrontendAccessSummary | null;
  accessLoading?: boolean;
};

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function getCompactStatusLabel(access?: FrontendAccessSummary | null) {
  const isAdmin = access?.isAdmin === true;
  const status = access?.access_status ?? access?.accessStatus;

  if (isAdmin) {
    return "Plano";
  }

  if (status === "trial_active" || status === "trial_expired") {
    return "Trial";
  }

  if (status === "subscription_active" || status === "subscription_expired") {
    return "Plano";
  }

  return null;
}

function getCompactStatusBadge(access?: FrontendAccessSummary | null) {
  const isAdmin = access?.isAdmin === true;
  const status = access?.access_status ?? access?.accessStatus;

  if (isAdmin) {
    return {
      label: "ATIVO",
      className: "bg-[#e1e1e1] text-slate-800",
    };
  }

  if (status === "trial_active" || status === "subscription_active") {
    return {
      label: "ATIVO",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  if (status === "trial_expired" || status === "subscription_expired") {
    return {
      label: "EXPIRADO",
      className: "bg-amber-100 text-amber-700",
    };
  }

  return null;
}

function getTrialDaysRemaining(trialEndsAt?: string | null) {
  if (!trialEndsAt) return null;

  const end = new Date(trialEndsAt);
  if (Number.isNaN(end.getTime())) return null;

  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(diffDays, 0);
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  userLabel,
  isBlocked = false,
  blockedMessage = "",
  blockedCta = null,
  access = null,
  accessLoading = false,
}: ChatSidebarProps) {
  const [showStatusDetails, setShowStatusDetails] = useState(false);

  const compactStatusLabel = useMemo(
    () => getCompactStatusLabel(access),
    [access]
  );

  const compactStatusBadge = useMemo(
    () => getCompactStatusBadge(access),
    [access]
  );

  const sidebarCta = useMemo(() => {
    if (access?.isAdmin) return null;
    return getSidebarAccessCta(access?.access_status ?? access?.accessStatus);
  }, [access]);

  const trialDaysRemaining = useMemo(
    () => getTrialDaysRemaining(access?.trialEndsAt),
    [access?.trialEndsAt]
  );

  const isAdmin = access?.isAdmin === true;

  const messagesUsed =
    typeof access?.messagesUsed === "number" ? access.messagesUsed : null;

  const trialMessageLimit =
    typeof access?.trialMessageLimit === "number"
      ? access.trialMessageLimit
      : null;

  const pdfUsed =
    typeof access?.pdfUsage?.used === "number" ? access.pdfUsage.used : null;

  const pdfLimit =
    typeof access?.pdfUsage?.limit === "number" ? access.pdfUsage.limit : null;

  const pdfPeriod = access?.pdfUsage?.period ?? null;

  const showCompactTrialBar =
    !accessLoading &&
    !!access &&
    !!compactStatusLabel &&
    !isBlocked;

  let lastRenderedDate = "";

  function toggleStatusDetails() {
    setShowStatusDetails((prev) => !prev);
  }

  return (
    <aside className="flex w-full flex-col overflow-x-hidden border-r border-slate-200 bg-[#e0e0e0] md:w-72">
      <div className="bg-white px-4 pt-4 pb-4">
        <div className="flex items-start gap-2">
          <a
            href="https://nexuspublica.com.br/"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Image
              src="/logos/nexus.png"
              alt="Logo Publ.IA"
              width={32}
              height={32}
              className="rounded-lg"
            />
          </a>

          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold text-slate-900">
              Publ.IA ESSENCIAL 1.7
            </span>

            {showCompactTrialBar && compactStatusBadge ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-slate-900">
                  {compactStatusLabel}
                </span>

                <button
                  type="button"
                  onClick={toggleStatusDetails}
                  className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-[10px] font-semibold leading-none transition hover:brightness-95 ${compactStatusBadge.className}`}
                  title="Ver status"
                >
                  {compactStatusBadge.label}
                </button>

                <button
                  type="button"
                  onClick={toggleStatusDetails}
                  className="inline-flex items-center justify-center rounded-full bg-[#f5a000] px-3 py-1 text-[10px] font-semibold leading-none text-white transition hover:brightness-105"
                >
                  {showStatusDetails ? "OCULTAR" : "VER STATUS"}
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-slate-500">&nbsp;</span>
            )}
          </div>
        </div>

        {showCompactTrialBar && showStatusDetails && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-[#f8f8f8] px-3 py-3 text-[12px] text-slate-700">
            {isAdmin ? (
              <>
                {messagesUsed !== null && (
                  <div className="mb-2 rounded-lg bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold text-slate-900">
                      Mensagens
                    </div>
                    <div className="mt-1 text-[12px] text-slate-700">
                      {messagesUsed} usadas
                    </div>
                  </div>
                )}

                {pdfUsed !== null && (
                  <div className="rounded-lg bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold text-slate-900">
                      PDFs
                    </div>
                    <div className="mt-1 text-[12px] text-slate-700">
                      {pdfUsed} usados
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {access?.access_status === "trial_active" &&
                  trialDaysRemaining !== null && (
                    <div className="mb-2 rounded-lg bg-white px-3 py-2">
                      <div className="text-[11px] font-semibold text-slate-900">
                        Trial
                      </div>
                      <div className="mt-1 text-[12px] text-slate-700">
                        {trialDaysRemaining} dia
                        {trialDaysRemaining === 1 ? "" : "s"} restante
                        {trialDaysRemaining === 1 ? "" : "s"}
                      </div>
                    </div>
                  )}

                {trialMessageLimit !== null && messagesUsed !== null && (
                  <div className="mb-2 rounded-lg bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold text-slate-900">
                      Mensagens
                    </div>
                    <div className="mt-1 text-[12px] text-slate-700">
                      {messagesUsed}/{trialMessageLimit} usadas
                    </div>
                  </div>
                )}

                {pdfUsed !== null && (
                  <div className="rounded-lg bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold text-slate-900">
                      PDFs
                    </div>
                    <div className="mt-1 text-[12px] text-slate-700">
                      {pdfLimit !== null
                        ? `${pdfUsed}/${pdfLimit} usados`
                        : `${pdfUsed} usados`}
                      {pdfPeriod === "month" ? " neste mês" : ""}
                    </div>
                  </div>
                )}

                {sidebarCta && (
                  <a
                    href={sidebarCta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#f5a000] px-3 py-2 text-[11px] font-semibold text-white transition hover:brightness-105"
                  >
                    {sidebarCta.label}
                  </a>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={onNewConversation}
          disabled={isBlocked}
          className="flex justify-start disabled:cursor-not-allowed"
          title={isBlocked ? blockedMessage : "Criar nova conversa"}
        >
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 shadow transition ${
              isBlocked
                ? "bg-[#8a8a8a] opacity-60"
                : "bg-[#696969] hover:shadow-md hover:brightness-105"
            }`}
          >
            <span className="leading-none text-lg font-bold text-white">+</span>
            <span className="text-[11px] font-semibold tracking-wide text-white">
              NOVA CONVERSA
            </span>
          </div>
        </button>
      </div>

      {isBlocked && blockedMessage && (
        <div className="px-4 pb-3">
          <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-3 text-[11px] leading-snug text-amber-900">
            <div className="font-semibold">Acesso bloqueado para novas ações</div>
            <div className="mt-1">{blockedMessage}</div>

            {blockedCta && (
              <a
                href={blockedCta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-3 py-2 text-[11px] font-semibold text-slate-950 transition hover:bg-amber-400"
              >
                {blockedCta.label}
              </a>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
        <div className="mb-2 text-xs font-semibold text-slate-600">
          HISTÓRICO
        </div>

        <div className="space-y-1 pr-1">
          {conversations.length === 0 && (
            <div className="text-[12px] text-slate-500">
              Nenhuma conversa ainda. Clique em{" "}
              <span className="font-semibold">NOVA CONVERSA</span> para começar.
            </div>
          )}

          {conversations.map((conv) => {
            const dateLabel = formatDateShort(conv.created_at);
            const showDate =
              dateLabel && dateLabel !== "" && dateLabel !== lastRenderedDate;

            if (showDate) {
              lastRenderedDate = dateLabel;
            }

            const isActive = conv.id === activeConversationId;
            const title =
              conv.title && conv.title.trim().length > 0
                ? conv.title.trim()
                : "Nova conversa";

            return (
              <React.Fragment key={conv.id}>
                {showDate && dateLabel && (
                  <div className="mt-2 mb-1 text-[11px] font-semibold text-slate-500">
                    {dateLabel}
                  </div>
                )}

                <div
                  className={
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] cursor-pointer " +
                    (isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "bg-transparent text-slate-700 hover:bg-white/60")
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className="flex-1 max-w-full text-left"
                  >
                    <div className="line-clamp-2 break-words leading-snug">
                      {title}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteConversation(conv.id)}
                    className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 text-[16px] leading-none text-slate-500 transition hover:border-red-500 hover:bg-red-500 hover:text-white"
                    title="Excluir conversa"
                  >
                    –
                  </button>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="mt-auto border-t border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-700">
        <div>
          Usuário: <span className="font-semibold">{userLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/logout";
          }}
          className="mt-2 inline-flex items-center justify-center rounded-full bg-[#04bd2c] px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90"
        >
          SAIR
        </button>
      </div>
    </aside>
  );
}