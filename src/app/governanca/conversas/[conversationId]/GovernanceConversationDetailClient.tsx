// src/app/governanca/conversas/[conversationId]/GovernanceConversationDetailClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Bot,
  Clock3,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react";

import GovernanceHeader from "../../components/GovernanceHeader";
import GovernanceSidebar from "../../components/GovernanceSidebar";
import {
  getGovernanceFunctionalRoleLabel,
  getGovernanceResponseModeLabel,
  getGovernanceTechnicalRoleLabel,
  getGovernanceVisibilityLabel,
  getOrganizationStatusLabel,
  type GovernanceContext,
  type GovernanceConversation,
  type GovernanceMessage,
} from "@/types/governance";

type GovernanceConversationDetailClientProps = {
  userId: string;
  userLabel: string;
  userEmail: string | null;
  context: GovernanceContext;
  conversation: GovernanceConversation;
  initialMessages: GovernanceMessage[];
};

function formatDateTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function mergeMessages(
  currentMessages: GovernanceMessage[],
  newMessages: GovernanceMessage[],
) {
  const map = new Map<string, GovernanceMessage>();

  for (const message of currentMessages) {
    map.set(message.id, message);
  }

  for (const message of newMessages) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort((a, b) => {
    return (
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });
}

export default function GovernanceConversationDetailClient({
  userId,
  userLabel,
  userEmail,
  context,
  conversation,
  initialMessages,
}: GovernanceConversationDetailClientProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] =
    useState<GovernanceMessage[]>(initialMessages);
  const [messageText, setMessageText] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isSendingMessage, startSendMessageTransition] = useTransition();

  const { organization, membership } = context;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages.length, isSendingMessage]);

  async function handleSendMessage() {
    const content = messageText.trim();

    if (!content) {
      setMessageError("Digite uma mensagem antes de enviar.");
      return;
    }

    setMessageError(null);
    setMessageText("");

    startSendMessageTransition(async () => {
      try {
        const response = await fetch("/api/governance/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            content,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error ?? "Não foi possível gerar a resposta da IA.",
          );
        }

        const newMessages = [
          payload.userMessage as GovernanceMessage,
          payload.assistantMessage as GovernanceMessage,
        ].filter(Boolean);

        setMessages((currentMessages) =>
          mergeMessages(currentMessages, newMessages),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao enviar mensagem.";

        setMessageError(message);
        setMessageText(content);
      }
    });
  }

  function handleMessageKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    handleSendMessage();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5] text-slate-900">
      <GovernanceHeader
        userLabel={userLabel}
        userEmail={userEmail}
        organizationName={organization.name}
        organizationStatusLabel={getOrganizationStatusLabel(organization.status)}
      />

      <div className="flex min-h-0 flex-1">
        <GovernanceSidebar
          organizationName={organization.name}
          functionalRoleLabel={getGovernanceFunctionalRoleLabel(
            membership.functional_role,
          )}
          technicalRoleLabel={getGovernanceTechnicalRoleLabel(
            membership.technical_role,
          )}
        />

        <main className="flex min-w-0 flex-1 flex-col p-6">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-[#dedede] bg-white shadow-sm">
            <header className="border-b border-[#dedede] bg-white p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <Link
                    href="/governanca/conversas"
                    className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#dedede] bg-[#f8f8f8] px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-[#e6e6e6]"
                  >
                    <ArrowLeft size={14} />
                    Voltar para conversas
                  </Link>

                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
                    <ShieldCheck size={14} />
                    Chat institucional
                  </div>

                  <h1 className="line-clamp-2 text-2xl font-bold text-slate-950">
                    {conversation.title}
                  </h1>

                  <p className="mt-2 text-sm text-slate-600">
                    {conversation.category ||
                      "Conversa institucional sem categoria definida."}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-xs text-slate-700">
                  <p>
                    <strong>Modo:</strong>{" "}
                    {getGovernanceResponseModeLabel(
                      conversation.response_mode,
                    )}
                  </p>

                  <p className="mt-1">
                    <strong>Visibilidade:</strong>{" "}
                    {getGovernanceVisibilityLabel(conversation.visibility)}
                  </p>

                  <p className="mt-1 break-all">
                    <strong>Org:</strong> {organization.id}
                  </p>
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8f8f8] p-6">
              {messages.length === 0 && !isSendingMessage ? (
                <div className="flex h-full items-center justify-center">
                  <div className="max-w-xl text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
                      <Bot size={26} />
                    </div>

                    <h2 className="text-xl font-bold text-slate-950">
                      Comece a conversa institucional
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Esta tela foi isolada para trabalhar com mais foco. A
                      conversa continua vinculada ao órgão e protegida por
                      organization_id.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-5xl space-y-4">
                  {messages.map((message) => {
                    const isCurrentUser =
                      message.role === "user" && message.user_id === userId;

                    const isAssistant = message.role === "assistant";

                    return (
                      <div
                        key={message.id}
                        className={[
                          "flex",
                          isCurrentUser ? "justify-end" : "justify-start",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "overflow-x-auto break-words rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm",
                            isCurrentUser
                              ? "max-w-[72%] bg-[#0f3a4a] text-white"
                              : "max-w-[86%] border border-[#dedede] bg-white text-slate-800",
                          ].join(" ")}
                        >
                          {isAssistant && (
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#0f3a4a]">
                              <Bot size={15} />
                              Publ.IA Governança
                            </div>
                          )}

                          <p className="whitespace-pre-wrap">
                            {message.content}
                          </p>

                          <p
                            className={[
                              "mt-2 flex items-center gap-1 text-[11px]",
                              isCurrentUser
                                ? "text-white/70"
                                : "text-slate-400",
                            ].join(" ")}
                          >
                            <Clock3 size={12} />
                            {formatDateTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {isSendingMessage && (
                    <div className="flex justify-start">
                      <div className="max-w-[86%] rounded-3xl border border-[#dedede] bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#0f3a4a]">
                          <Bot size={15} />
                          Publ.IA Governança
                        </div>

                        <div className="flex items-center gap-2">
                          <Loader2
                            size={16}
                            className="animate-spin text-[#0f3a4a]"
                          />
                          <span>Elaborando resposta institucional...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <footer className="border-t border-[#dedede] bg-white p-4">
              {messageError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {messageError}
                </div>
              )}

              <div className="mx-auto flex max-w-5xl items-center gap-3 rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm text-slate-700">
                <input
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  onKeyDown={handleMessageKeyDown}
                  disabled={isSendingMessage}
                  placeholder={
                    isSendingMessage
                      ? "A Publ.IA Governança está respondendo..."
                      : "Digite uma mensagem institucional..."
                  }
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isSendingMessage || !messageText.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f3a4a] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Enviar mensagem"
                >
                  {isSendingMessage ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            </footer>
          </section>
        </main>
      </div>
    </div>
  );
}