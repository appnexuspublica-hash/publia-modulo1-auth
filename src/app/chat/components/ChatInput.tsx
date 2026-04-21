//src/app/chat/components/ChatInput.tsx
"use client";

import React, {
  useState,
  useRef,
  KeyboardEvent,
  FormEvent,
  ChangeEvent,
  useMemo,
  useEffect,
} from "react";
import { getChatTheme } from "@/app/chat/theme";

export type ResponseMode =
  | "objective"
  | "summary"
  | "manager_guidance"
  | "checklist"
  | "step_by_step"
  | "document_draft"
  | "attention_points";

type ChatInputProps = {
  onSend: (message: string) => void | Promise<void>;
  isSending?: boolean;
  onStop?: () => void;
  disabled?: boolean;
  responseMode?: ResponseMode;
  onResponseModeChange?: (mode: ResponseMode) => void;
  showResponseModes?: boolean;
  availableResponseModes?: ResponseMode[];
  isStrategic?: boolean;

  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  externalTextareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
};

const RESPONSE_MODE_LABELS: Record<ResponseMode, string> = {
  objective: "Padrão",
  summary: "Resumo",
  manager_guidance: "Orientação ao gestor",
  checklist: "Checklist",
  step_by_step: "Passo a passo",
  document_draft: "Minuta de documento",
  attention_points: "Pontos de atenção",
};

const ALL_RESPONSE_MODES: ResponseMode[] = [
  "objective",
  "summary",
  "manager_guidance",
  "checklist",
  "step_by_step",
  "document_draft",
  "attention_points",
];

function isResponseMode(value: unknown): value is ResponseMode {
  return ALL_RESPONSE_MODES.includes(value as ResponseMode);
}

export function ChatInput({
  onSend,
  isSending = false,
  onStop,
  disabled,
  responseMode,
  onResponseModeChange,
  showResponseModes = false,
  availableResponseModes = [],
  isStrategic = false,
  inputValue,
  onInputValueChange,
  externalTextareaRef,
}: ChatInputProps) {
  const [internalValue, setInternalValue] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isDisabled = !!disabled || isSending;
  const isBlockedState = !!disabled && !isSending;
  const theme = useMemo(() => getChatTheme(isStrategic), [isStrategic]);

  const isControlled =
    typeof inputValue === "string" && typeof onInputValueChange === "function";

  const value = isControlled ? inputValue : internalValue;

  const setValue = (nextValue: string) => {
    if (isControlled) {
      onInputValueChange?.(nextValue);
      return;
    }

    setInternalValue(nextValue);
  };

  const modeOptions = useMemo(() => {
    const normalized = availableResponseModes.filter(isResponseMode);
    const unique = Array.from(new Set(normalized));
    return unique.length > 0 ? unique : ALL_RESPONSE_MODES;
  }, [availableResponseModes]);

  const effectiveResponseMode = useMemo(() => {
    const candidate = responseMode ?? modeOptions[0];
    return isResponseMode(candidate) ? candidate : modeOptions[0];
  }, [responseMode, modeOptions]);

  const selectedModeLabel = RESPONSE_MODE_LABELS[effectiveResponseMode];

  useEffect(() => {
    if (!showResponseModes) {
      setIsMenuOpen(false);
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isMenuOpen, showResponseModes]);

  useEffect(() => {
    if (externalTextareaRef) {
      externalTextareaRef.current = textareaRef.current;
    }
  }, [externalTextareaRef]);

  useEffect(() => {
    if (!textareaRef.current) return;
    autoResize(textareaRef.current);
  }, [value]);

  function autoResize(el: HTMLTextAreaElement) {
    const maxHeight = 120;
    el.style.height = "0px";
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;
  }

  async function submitMessage() {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;

    try {
      await onSend(trimmed);
      setValue("");
      setIsMenuOpen(false);

      if (textareaRef.current) {
        textareaRef.current.style.height = "40px";
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await submitMessage();
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    autoResize(e.target);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitMessage();
    }
  }

  function handleSelectResponseMode(mode: ResponseMode) {
    onResponseModeChange?.(mode);
    setIsMenuOpen(false);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex justify-center">
        <div
          className={`flex w-full max-w-3xl items-center rounded-2xl px-4 py-2 ${
            isBlockedState
              ? "border border-amber-300/70 opacity-90"
              : !isStrategic
                ? "border border-slate-300 shadow-sm"
                : "shadow-md"
          }`}
          style={{
            backgroundColor: isBlockedState
              ? "#efefef"
              : isStrategic
                ? theme.colors.bgTertiary
                : "#efefef",
            borderColor: isBlockedState
              ? undefined
              : isStrategic
                ? theme.colors.borderStrong
                : undefined,
          }}
        >
          {showResponseModes && (
            <div ref={menuRef} className="relative mr-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (isDisabled) return;
                  setIsMenuOpen((prev) => !prev);
                }}
                disabled={isDisabled}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-[28px] font-medium leading-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isStrategic ? "publia-strategic-plus-btn" : ""
                }`}
                style={{
                  color: isStrategic ? theme.colors.textMuted : "#64748b",
                }}
                aria-label="Abrir menu de opções"
                title="Abrir opções"
              >
                +
              </button>

              {isMenuOpen && (
                <div
                  className={`absolute bottom-[calc(100%+10px)] left-0 z-30 w-72 rounded-2xl border p-2 shadow-xl ${
                    isStrategic
                      ? "publia-strategic-response-menu"
                      : "border-slate-200 bg-white"
                  }`}
                  style={
                    isStrategic
                      ? {
                          borderColor: theme.colors.borderStrong,
                          backgroundColor: theme.colors.bg,
                        }
                      : undefined
                  }
                >
                  <div
                    className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
                    style={{
                      color: isStrategic ? theme.colors.textSoft : "#64748b",
                    }}
                  >
                    Modo de resposta
                  </div>

                  <div className="flex flex-col gap-1">
                    {modeOptions.map((option) => {
                      const isActive = option === effectiveResponseMode;

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleSelectResponseMode(option)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition ${
                            isStrategic
                              ? "publia-strategic-response-option"
                              : isActive
                                ? "bg-[#143755] text-white"
                                : "text-slate-700 hover:bg-slate-100"
                          }`}
                          style={
                            isStrategic
                              ? {
                                  color: isActive ? "#0f172a" : theme.colors.text,
                                  backgroundColor: isActive
                                    ? "#e5e5e5"
                                    : "transparent",
                                }
                              : undefined
                          }
                        >
                          <span>{RESPONSE_MODE_LABELS[option]}</span>
                          {isActive && <span className="text-[12px]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <textarea
            ref={textareaRef}
            placeholder={
              isSending
                ? "Gerando resposta… (você pode PARAR)"
                : disabled
                  ? "Acesso bloqueado. Regularize sua conta para enviar novas mensagens."
                  : "Envie sua pergunta..."
            }
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 resize-none overflow-y-auto border-none bg-transparent text-sm leading-normal outline-none"
            style={{
              color: isBlockedState
                ? "#64748b"
                : isStrategic
                  ? theme.colors.text
                  : "#0f172a",
            }}
            disabled={isDisabled}
          />

          {isSending ? (
            <button
              type="button"
              onClick={onStop}
              className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-[14px] font-semibold text-white hover:bg-red-700"
              aria-label="Parar geração"
              title="Parar"
            >
              ■
            </button>
          ) : (
            <button
              type="submit"
              disabled={isDisabled}
              className={`ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold ${
                isBlockedState
                  ? "cursor-not-allowed bg-slate-300 text-slate-500"
                  : !isStrategic
                    ? "border border-slate-400 bg-[#dddddd] text-slate-800 hover:bg-[#d4d4d4] disabled:opacity-60"
                    : "publia-strategic-send-btn disabled:opacity-60"
              }`}
              style={
                !isBlockedState && isStrategic
                  ? {
                      backgroundColor: "#bbbbbb",
                      color: "#0f172a",
                      border: `1px solid ${theme.colors.borderStrong}`,
                    }
                  : undefined
              }
              aria-label="Enviar"
              title="Enviar"
            >
              ↑
            </button>
          )}
        </div>
      </form>

      {showResponseModes && (
        <div className="mx-auto w-full max-w-3xl px-3">
          <div
            className="text-[11px]"
            style={{
              color: isStrategic ? theme.colors.textMuted : "#475569",
            }}
          >
            Modo de Resposta: {selectedModeLabel}
          </div>
        </div>
      )}

      <div
        className="w-full px-4 py-3 text-center text-[12px] leading-relaxed"
        style={{
          backgroundColor: theme.colors.bg,
          color: isStrategic ? theme.colors.text : "#1f2937",
        }}
      >
        <p className="mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>©2026 - </span>
          <a
            href="https://nexuspublica.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            Nexus Pública
          </a>
          <span>|</span>
          <span>Todos os direitos reservados</span>
          <span>|</span>
          <a
            href="https://nexuspublica.com.br/app-publ-ia/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            Sobre Publ.IA
          </a>
          <span>|</span>
          <a
            href="https://nexuspublica.com.br/termo-de-uso/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            Termo de Uso
          </a>
          <span>|</span>
          <a
            href="https://nexuspublica.com.br/contato/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            Fale Conosco
          </a>
        </p>
      </div>

      <style jsx>{`
        textarea::placeholder {
          color: ${
            isBlockedState
              ? "#64748b"
              : isStrategic
                ? "rgba(255, 255, 255, 0.8)"
                : "#475569"
          };
        }

        .publia-strategic-plus-btn:hover {
          background-color: ${theme.colors.buttonGhostHover};
          color: ${theme.colors.text};
        }

        .publia-strategic-response-menu {
          backdrop-filter: none;
          opacity: 1;
        }

        .publia-strategic-response-option:hover {
          background-color: ${theme.colors.buttonGhostHover} !important;
        }

        .publia-strategic-send-btn:hover {
          filter: brightness(1.08);
        }
      `}</style>
    </div>
  );
}