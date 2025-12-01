// src/app/chat/components/ChatSidebar.tsx
"use client";

import React from "react";
import Image from "next/image";

type ConversationItem = {
  id: string;
  title: string | null;
  created_at: string;
  is_shared?: boolean;
  share_id?: string | null;
};

type ChatSidebarProps = {
  conversations: ConversationItem[];
  activeConversationId: string | null;
  onNewConversation: () => void | Promise<void>;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  userLabel: string;
};

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  userLabel,
}: ChatSidebarProps) {
  let lastRenderedDate = "";

  return (
    <aside className="flex w-full flex-col overflow-x-hidden border-r border-slate-200 bg-[#e0e0e0] md:w-72">
      {/* Área 1: topo branco com logo + textos */}
      <div className="bg-white px-4 pt-4 pb-4">
        <div className="flex items-center gap-2">
          <Image
            src="/logos/nexus.png"
            alt="Logo Publ.IA"
            width={32}
            height={32}
            className="rounded-lg"
          />

          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900">
              Publ.IA 1.0
            </span>
            <span className="text-[11px] text-slate-500">
              Nexus Pública
            </span>
          </div>
        </div>
      </div>

      {/* Botão NOVA CONVERSA */}
      <div className="px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={onNewConversation}
          className="flex justify-start"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-[#fbbf24] px-3 py-2 shadow transition hover:shadow-md hover:brightness-105">
            <span className="leading-none text-lg font-bold text-white">
              +
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-white">
              NOVA CONVERSA
            </span>
          </div>
        </button>
      </div>

      {/* Corpo: histórico de conversas */}
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
                  {/* selecionar conversa */}
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className="flex-1 max-w-full text-left"
                  >
                    <div className="line-clamp-2 break-words leading-snug">
                      {title}
                    </div>
                  </button>

                  {/* excluir conversa */}
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

      {/* Área 2: rodapé com usuário + botão SAIR */}
      <div className="mt-auto border-t border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-700">
        <div>
          Usuário:{" "}
          <span className="font-semibold">
            {userLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            // logout real: rota /logout faz signOut e redireciona para o site
            window.location.href = "/logout";
          }}
          className="mt-2 inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90 bg-[#04bd2c]"
        >
          SAIR
        </button>
      </div>
    </aside>
  );
}
