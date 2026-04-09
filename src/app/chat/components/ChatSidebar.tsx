//src/app/chat/components/ChatSidebar.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { getSidebarAccessCta } from "@/lib/access-cta";
import type { FrontendAccessSummary } from "@/lib/access-client";
import type { ProductTier } from "@/types/access";

type ConversationItem = {
  id: string;
  title: string | null;
  created_at: string;
  is_shared?: boolean;
  share_id?: string | null;
  is_favorite?: boolean;
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
  onToggleFavorite?: (id: string, nextValue: boolean) => void | Promise<void>;
  onRenameConversation?: (id: string, nextTitle: string) => void | Promise<void>;
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

function normalizeProductTier(value: unknown): ProductTier {
  if (value === "strategic" || value === "governance" || value === "essential") {
    return value;
  }

  return "essential";
}

function getCompactStatusBadge(access?: FrontendAccessSummary | null) {
  const isAdmin = access?.isAdmin === true;
  const status = access?.access_status ?? access?.accessStatus;

  if (isAdmin) {
    return {
      label: "ADMIN",
      className: "bg-[#e1e1e1] text-slate-800",
    };
  }

  if (status === "trial_active") {
    return {
      label: "TRIAL ATIVO",
      className: "bg-[#e1e1e1] text-slate-800",
    };
  }

  if (status === "subscription_active") {
    return {
      label: "ASSINANTE",
      className: "bg-[#e1e1e1] text-slate-800",
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

function getTierBadge(productTier?: ProductTier) {
  if (productTier === "strategic") {
    return {
      label: "ESTRATÉGICO",
      className: "bg-[#dbeafe] text-[#1d4ed8]",
    };
  }

  if (productTier === "governance") {
    return {
      label: "GOVERNANÇA",
      className: "bg-[#ede9fe] text-[#6d28d9]",
    };
  }

  return {
    label: "ESSENCIAL",
    className: "bg-[#ecfccb] text-[#3f6212]",
  };
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

function getSubscriptionPlanLabel(
  access?: FrontendAccessSummary | null
): string | null {
  const rawPlan = access?.subscriptionPlan ?? null;

  if (!rawPlan) return null;

  if (rawPlan === "monthly") return "MENSAL";
  if (rawPlan === "annual") return "ANUAL";

  return String(rawPlan).toUpperCase();
}

function normalizeConversationTitle(title: string | null | undefined) {
  const clean = String(title ?? "").trim();
  return clean.length > 0 ? clean : "Nova conversa";
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onToggleFavorite,
  onRenameConversation,
  userLabel,
  isBlocked = false,
  blockedMessage = "",
  blockedCta = null,
  access = null,
  accessLoading = false,
}: ChatSidebarProps) {
  const [showStatusDetails, setShowStatusDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(
    null
  );
  const [editingTitle, setEditingTitle] = useState("");
  const [submittingFavoriteId, setSubmittingFavoriteId] = useState<string | null>(
    null
  );
  const [submittingRenameId, setSubmittingRenameId] = useState<string | null>(null);
  const [openMenuConversationId, setOpenMenuConversationId] = useState<string | null>(
    null
  );
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const effectiveProductTier = useMemo(
    () => normalizeProductTier(access?.productTier),
    [access?.productTier]
  );

  const isStrategic = effectiveProductTier === "strategic";
  const isEssential = effectiveProductTier === "essential";

  const effectiveBrand = useMemo(() => {
    const fallbackByTier: Record<ProductTier, FrontendAccessSummary["brand"]> = {
      essential: {
        productName: "Publ.IA Essencial",
        productLabel: "Publ.IA ESSENCIAL",
        versionLabel: "1.7",
        vendorLabel: "Nexus Pública",
        accentVariant: "essential",
      },
      strategic: {
        productName: "Publ.IA Estratégico",
        productLabel: "Publ.IA ESTRATÉGICO",
        versionLabel: "2.0",
        vendorLabel: "Nexus Pública",
        accentVariant: "strategic",
      },
      governance: {
        productName: "Publ.IA Governança",
        productLabel: "Publ.IA GOVERNANÇA",
        versionLabel: "3.0",
        vendorLabel: "Nexus Pública",
        accentVariant: "governance",
      },
    };

    return access?.brand ?? fallbackByTier[effectiveProductTier];
  }, [access?.brand, effectiveProductTier]);

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

  const subscriptionPlanLabel = useMemo(
    () => getSubscriptionPlanLabel(access),
    [access]
  );

  const tierBadge = useMemo(
    () => getTierBadge(effectiveProductTier),
    [effectiveProductTier]
  );

  const filteredAndSortedConversations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const filtered = conversations.filter((conv) => {
      if (!term) return true;
      const normalizedTitle = normalizeConversationTitle(conv.title).toLowerCase();
      return normalizedTitle.includes(term);
    });

    if (!isStrategic) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      const aFav = a.is_favorite === true ? 1 : 0;
      const bFav = b.is_favorite === true ? 1 : 0;

      if (aFav !== bFav) {
        return bFav - aFav;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [conversations, isStrategic, searchTerm]);

  const isAdmin = access?.isAdmin === true;
  const status = access?.access_status ?? access?.accessStatus;

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
    !!compactStatusBadge &&
    !isBlocked &&
    !isEssential;

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuContainerRef.current) return;
      if (!menuContainerRef.current.contains(event.target as Node)) {
        setOpenMenuConversationId(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  function toggleStatusDetails() {
    setShowStatusDetails((prev) => !prev);
  }

  function startRenameConversation(conv: ConversationItem) {
    if (!isStrategic) return;
    setOpenMenuConversationId(null);
    setEditingConversationId(conv.id);
    setEditingTitle(normalizeConversationTitle(conv.title));
  }

  function cancelRenameConversation() {
    setEditingConversationId(null);
    setEditingTitle("");
  }

  async function submitRenameConversation(id: string) {
    if (!onRenameConversation) {
      cancelRenameConversation();
      return;
    }

    const nextTitle = editingTitle.trim();
    if (!nextTitle) return;

    try {
      setSubmittingRenameId(id);
      await onRenameConversation(id, nextTitle);
      setEditingConversationId(null);
      setEditingTitle("");
    } finally {
      setSubmittingRenameId(null);
    }
  }

  async function handleToggleFavorite(conv: ConversationItem) {
    if (!isStrategic || !onToggleFavorite) return;

    const nextValue = !(conv.is_favorite === true);

    try {
      setSubmittingFavoriteId(conv.id);
      await onToggleFavorite(conv.id, nextValue);
      setOpenMenuConversationId(null);
    } finally {
      setSubmittingFavoriteId(null);
    }
  }

  async function handleDeleteFromMenu(id: string) {
    setOpenMenuConversationId(null);
    onDeleteConversation(id);
  }

  function handleToggleSearch() {
    setShowSearchInput((prev) => {
      const next = !prev;

      if (!next) {
        setSearchTerm("");
      }

      return next;
    });
  }

  let lastRenderedDate = "";

  return (
    <aside
      className={`flex w-full flex-col overflow-x-hidden border-r md:w-72 ${
        isStrategic
          ? "border-white/10 bg-[#656565]"
          : "border-slate-200 bg-[#dcdcdc]"
      }`}
    >
      <div className="bg-white px-4 pt-4 pb-4">
        {isEssential ? (
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
                {effectiveBrand.productLabel} {effectiveBrand.versionLabel}
              </span>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-[12px] text-slate-700">
                  Usuário: <span className="font-semibold">{userLabel}</span>
                </span>

                <button
                  type="button"
                  onClick={toggleStatusDetails}
                  className="inline-flex items-center justify-center rounded-full bg-[#f5a000] px-3 py-1 text-[10px] font-semibold leading-none text-white transition hover:brightness-105"
                >
                  {showStatusDetails ? "OCULTAR" : "STATUS"}
                </button>
              </div>
            </div>
          </div>
        ) : isStrategic ? (
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
                {effectiveBrand.productLabel} {effectiveBrand.versionLabel}
              </span>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-[12px] text-slate-700">
                  Usuário: <span className="font-semibold">{userLabel}</span>
                </span>

                <button
                  type="button"
                  onClick={toggleStatusDetails}
                  className="inline-flex items-center justify-center rounded-full bg-[#f5a000] px-3 py-1 text-[10px] font-semibold leading-none text-white transition hover:brightness-105"
                >
                  {showStatusDetails ? "OCULTAR" : "STATUS"}
                </button>
              </div>
            </div>
          </div>
        ) : (
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
                {effectiveBrand.productLabel} {effectiveBrand.versionLabel}
              </span>
              <span className="text-[11px] text-slate-500">
                {effectiveBrand.vendorLabel}
              </span>

              <div className="mt-2">
                <span
                  className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-[10px] font-semibold leading-none ${tierBadge.className}`}
                >
                  {tierBadge.label}
                </span>
              </div>

              {showCompactTrialBar && compactStatusBadge ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
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
                    {showStatusDetails ? "OCULTAR" : "STATUS"}
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-slate-500">&nbsp;</span>
              )}
            </div>
          </div>
        )}

        {showStatusDetails && !accessLoading && access && (
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
                  <div className="mb-2 rounded-lg bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold text-slate-900">
                      PDFs
                    </div>
                    <div className="mt-1 text-[12px] text-slate-700">
                      {pdfUsed} usados
                    </div>
                  </div>
                )}

                <div className="mb-2 rounded-lg bg-white px-3 py-2">
                  <div className="text-[11px] font-semibold text-slate-900">
                    Produto
                  </div>
                  <div className="mt-1 text-[12px] text-slate-700">
                    {effectiveBrand.productName}
                  </div>
                </div>

                <div className="rounded-lg bg-white px-3 py-2">
                  <div className="text-[11px] font-semibold text-slate-900">
                    Assinatura
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-slate-700">
                    ADMIN
                  </div>
                </div>
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
                  <div
                    className={`rounded-lg bg-white px-3 py-2 ${
                      status === "subscription_active" || subscriptionPlanLabel
                        ? "mb-2"
                        : ""
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-slate-900">
                      PDFs
                    </div>
                    <div className="mt-1 text-[12px] text-slate-700">
                      {pdfLimit !== null ? (
                        <>
                          {pdfUsed}/{pdfLimit} usados
                          {pdfPeriod === "account"
                            ? " na conta"
                            : pdfPeriod === "month"
                              ? " no mês"
                              : ""}
                        </>
                      ) : (
                        `${pdfUsed} usados`
                      )}
                    </div>
                  </div>
                )}

                {(status === "subscription_active" || subscriptionPlanLabel) && (
                  <div className="mb-2 rounded-lg bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold text-slate-900">
                      Assinatura
                    </div>
                    <div className="mt-1 text-[12px] text-slate-700">
                      {subscriptionPlanLabel ?? "ATIVA"}
                    </div>
                  </div>
                )}

                <div className="mb-2 rounded-lg bg-white px-3 py-2">
                  <div className="text-[11px] font-semibold text-slate-900">
                    Produto
                  </div>
                  <div className="mt-1 text-[12px] text-slate-700">
                    {effectiveBrand.productName}
                  </div>
                  {typeof access?.capabilities?.maxPdfsPerConversation === "number" && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Até {access.capabilities.maxPdfsPerConversation} PDFs por conversa
                    </div>
                  )}
                </div>

                {sidebarCta && (
                  <a
                    href={sidebarCta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-[#f5a000] px-3 py-2 text-[11px] font-semibold text-white transition hover:brightness-105"
                  >
                    {sidebarCta.label}
                  </a>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {isBlocked && blockedMessage && (
        <div className="px-4 pb-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] text-amber-900">
            <div className="font-semibold">Acesso bloqueado</div>
            <div className="mt-1 leading-snug">{blockedMessage}</div>

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
        <div className={isStrategic ? "mb-4 pt-5" : "mb-4 pt-2"}>
          {isStrategic ? (
            <>
              <button
                type="button"
                onClick={onNewConversation}
                disabled={isBlocked}
                className={`mb-4 block text-[12px] font-semibold transition ${
                  isBlocked
                    ? "cursor-not-allowed text-white/40"
                    : "text-white hover:text-white/80"
                }`}
              >
                +NOVA CONVERSA
              </button>

              <button
                type="button"
                onClick={handleToggleSearch}
                className="mb-3 block text-[12px] font-semibold tracking-[0.02em] text-white/85 transition hover:text-white"
              >
                {showSearchInput ? "FECHAR PESQUISA" : "PESQUISAR"}
              </button>

              {showSearchInput && (
                <div className="mb-3">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar conversa..."
                    className="w-full rounded-xl border border-white/15 bg-white/95 px-3 py-2 text-[12px] text-slate-800 outline-none placeholder:text-slate-500"
                    autoFocus
                  />
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onNewConversation}
              disabled={isBlocked}
              className={`mb-4 block text-[12px] font-semibold transition ${
                isBlocked
                  ? "cursor-not-allowed text-slate-400"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              +NOVA CONVERSA
            </button>
          )}

          <div
            className={`text-xs font-semibold ${
              isStrategic ? "text-white/90" : "text-slate-600"
            }`}
          >
            HISTÓRICO
          </div>
        </div>

        <div ref={menuContainerRef} className="space-y-1 pr-1">
          {filteredAndSortedConversations.length === 0 && (
            <div
              className={`text-[12px] ${
                isStrategic ? "text-white/80" : "text-slate-500"
              }`}
            >
              {searchTerm.trim()
                ? "Nenhuma conversa encontrada para a busca informada."
                : "Nenhuma conversa ainda. Clique em NOVA CONVERSA para começar."}
            </div>
          )}

          {filteredAndSortedConversations.map((conv) => {
            const isFavorite = conv.is_favorite === true;
            const dateLabel = formatDateShort(conv.created_at);

            const showDate =
              !isFavorite &&
              dateLabel &&
              dateLabel !== "" &&
              dateLabel !== lastRenderedDate;

            if (showDate) {
              lastRenderedDate = dateLabel;
            }

            const isActive = conv.id === activeConversationId;
            const isEditing = editingConversationId === conv.id;
            const title = normalizeConversationTitle(conv.title);
            const favoriteDisabled =
              !isStrategic ||
              !onToggleFavorite ||
              submittingFavoriteId === conv.id;
            const renameDisabled =
              !isStrategic ||
              !onRenameConversation ||
              submittingRenameId === conv.id;
            const isMenuOpen = openMenuConversationId === conv.id;

            return (
              <React.Fragment key={conv.id}>
                {showDate && dateLabel && (
                  <div
                    className={`mt-2 mb-1 text-[11px] font-semibold ${
                      isStrategic ? "text-white/65" : "text-slate-500"
                    }`}
                  >
                    {dateLabel}
                  </div>
                )}

                <div
                  className={
                    "rounded-lg px-3 py-2 transition " +
                    (isActive
                      ? isStrategic
                        ? "bg-[#909090] text-white shadow-sm"
                        : "bg-[#8d8d8d] text-white shadow-sm"
                      : isStrategic
                        ? "bg-transparent text-white hover:bg-white/10"
                        : "bg-transparent text-slate-700 hover:bg-white/60")
                  }
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void submitRenameConversation(conv.id);
                          }

                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRenameConversation();
                          }
                        }}
                        autoFocus
                        maxLength={120}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-[12px] text-slate-900 outline-none"
                      />

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void submitRenameConversation(conv.id)}
                          disabled={
                            renameDisabled || editingTitle.trim().length === 0
                          }
                          className="inline-flex items-center justify-center rounded-full bg-[#143755] px-3 py-1 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          SALVAR
                        </button>

                        <button
                          type="button"
                          onClick={cancelRenameConversation}
                          disabled={submittingRenameId === conv.id}
                          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          CANCELAR
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative flex w-full items-start gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectConversation(conv.id)}
                        className="flex-1 max-w-full text-left"
                      >
                        <div className="flex items-start gap-2">
                          {isStrategic && isFavorite && (
                            <span
                              className={`mt-[1px] shrink-0 text-[12px] ${
                                isActive ? "text-white" : "text-[#f5d76e]"
                              }`}
                              title="Conversa fixada"
                            >
                              ★
                            </span>
                          )}

                          <div className="line-clamp-2 break-words text-[13px] leading-snug">
                            {title}
                          </div>
                        </div>
                      </button>

                      {isStrategic ? (
                        <div className="relative ml-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuConversationId((prev) =>
                                prev === conv.id ? null : conv.id
                              )
                            }
                            className={`inline-flex h-6 items-center justify-center text-[18px] leading-none transition ${
                              isActive
                                ? "text-white hover:text-white/80"
                                : "text-white/85 hover:text-white"
                            }`}
                            title="Mais opções"
                            aria-label="Mais opções"
                          >
                            …
                          </button>

                          {isMenuOpen && (
                            <div
                              className={`absolute right-0 top-8 z-20 w-36 rounded-lg border shadow-lg ${
                                isActive
                                  ? "border-slate-200 bg-white"
                                  : "border-white/15 bg-[#4a4a4a]"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => void handleToggleFavorite(conv)}
                                disabled={favoriteDisabled}
                                className={`block w-full px-3 py-2 text-left text-[11px] font-medium transition ${
                                  isActive
                                    ? "text-slate-700 hover:bg-slate-100"
                                    : "text-white hover:bg-white/10"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                {isFavorite ? "Desafixar" : "Fixar"}
                              </button>

                              <button
                                type="button"
                                onClick={() => startRenameConversation(conv)}
                                disabled={renameDisabled}
                                className={`block w-full px-3 py-2 text-left text-[11px] font-medium transition ${
                                  isActive
                                    ? "text-slate-700 hover:bg-slate-100"
                                    : "text-white hover:bg-white/10"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                Renomear
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleDeleteFromMenu(conv.id)}
                                className={`block w-full px-3 py-2 text-left text-[11px] font-medium transition ${
                                  isActive
                                    ? "text-red-600 hover:bg-red-50"
                                    : "text-red-200 hover:bg-red-500/20"
                                }`}
                              >
                                Excluir
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDeleteConversation(conv.id)}
                          className={
                            "ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[16px] leading-none transition " +
                            (isActive
                              ? "border border-white/90 bg-[#6f6f6f] text-white hover:border-white hover:bg-[#5f5f5f]"
                              : "border border-slate-400 text-slate-500 hover:border-red-500 hover:bg-red-500 hover:text-white")
                          }
                          title="Excluir conversa"
                        >
                          –
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div
        className={`mt-auto border-t px-4 py-3 ${
          isStrategic
            ? "border-white/10 bg-white"
            : "border-slate-200 bg-white"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            window.location.href = "/logout";
          }}
          className="inline-flex items-center justify-center rounded-full bg-[#04bd2c] px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90"
        >
          SAIR
        </button>
      </div>
    </aside>
  );
}