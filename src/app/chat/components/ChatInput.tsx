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

export type ResponseMode =
  | "objective"
  | "summary"
  | "manager_guidance"
  | "checklist"
  | "step_by_step"
  | "document_draft";

type ChatInputProps = {
  onSend: (message: string) => void | Promise<void>;
  isSending?: boolean;
  onStop?: () => void;
  disabled?: boolean;
  responseMode?: ResponseMode;
  onResponseModeChange?: (mode: ResponseMode) => void;
  showResponseModes?: boolean;
  availableResponseModes?: ResponseMode[];
};

const RESPONSE_MODE_LABELS: Record<ResponseMode, string> = {
  objective: "Padrão",
  summary: "Resumo",
  manager_guidance: "Orientação ao gestor",
  checklist: "Checklist",
  step_by_step: "Passo a passo",
  document_draft: "Minuta de documento",
};

const ALL_RESPONSE_MODES: ResponseMode[] = [
  "objective",
  "summary",
  "manager_guidance",
  "checklist",
  "step_by_step",
  "document_draft",
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
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isDisabled = !!disabled || isSending;

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

  function autoResize(el: HTMLTextAreaElement) {
    const maxHeight = 120;
    el.style.height = "0px";
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = newHeight + "px";
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
        <div className="flex w-full max-w-3xl items-center rounded-2xl bg-white px-4 py-2 shadow-md">
          {showResponseModes && (
            <div ref={menuRef} className="relative mr-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (isDisabled) return;
                  setIsMenuOpen((prev) => !prev);
                }}
                disabled={isDisabled}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-[28px] font-medium leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Abrir menu de opções"
                title="Abrir opções"
              >
                +
              </button>

              {isMenuOpen && (
                <div className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
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
                            isActive
                              ? "bg-[#143755] text-white"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
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
                  ? "Seu acesso está bloqueado para novas ações."
                  : "Envie sua pergunta..."
            }
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 resize-none overflow-y-auto border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 leading-normal"
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
              className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#bbbbbb] text-lg font-semibold text-slate-900 disabled:opacity-60"
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
          <div className="text-[11px] text-slate-300">
            Modo de Resposta: {selectedModeLabel}
          </div>
        </div>
      )}

      <div className="w-full bg-[#2b4e67] px-4 py-3 text-center text-[12px] leading-snug text-white">
        <p className="mx-auto">
          IMPORTANTE: Publ.IA é uma ferramenta de apoio técnico e informativo. Não substitui a
          assessoria jurídica, contábil ou de controle interno. As informações são baseadas na
          legislação vigente e devem ser revisadas antes de uso oficial - Nexus Pública @2026 -
          Todos os direitos reservados |{" "}
          <a
            href="https://www.nexuspublica.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 underline"
          >
            www.nexuspublica.com.br
          </a>
          <span className="mx-1">|</span>
          <a
            href="https://nexuspublica.com.br/sobre-o-publia/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Sobre Publ.IA
          </a>
          <span className="mx-1">|</span>
          <a
            href="https://nexuspublica.com.br/termo-de-uso/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Termo de Uso.
          </a>
        </p>
      </div>
    </div>
  );
}