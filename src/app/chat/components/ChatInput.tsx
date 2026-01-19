// src/app/chat/components/ChatInput.tsx
"use client";

import React, { useState, useRef, KeyboardEvent, FormEvent, ChangeEvent } from "react";

type ChatInputProps = {
  onSend: (message: string) => void | Promise<void>;

  // ✅ novo
  isSending?: boolean;
  onStop?: () => void;

  // compat (se você ainda usa em algum lugar)
  disabled?: boolean;
};

export function ChatInput({ onSend, isSending = false, onStop, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isDisabled = !!disabled || isSending;

  function autoResize(el: HTMLTextAreaElement) {
    const maxHeight = 120;
    el.style.height = "0px";
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = newHeight + "px";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;

    await onSend(trimmed);
    setValue("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    autoResize(e.target);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || isDisabled) return;

      onSend(trimmed);
      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "40px";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex justify-center">
        <div className="flex w-full max-w-3xl items-center rounded-2xl bg-white px-4 py-2 shadow-md">
          <textarea
            ref={textareaRef}
            placeholder={isSending ? "Gerando resposta… (você pode PARAR)" : "Envie sua pergunta..."}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 resize-none overflow-y-auto border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 leading-normal"
            disabled={isDisabled}
          />

          {/* ✅ Quando está enviando: mostra PARAR | senão: botão enviar */}
          {isSending ? (
            <button
              type="button"
              onClick={onStop}
              className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white text-[14px] font-semibold hover:bg-red-700"
              aria-label="Parar geração"
              title="Parar"
            >
              ■
            </button>
          ) : (
            <button
              type="submit"
              disabled={isDisabled}
              className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#ffae00] text-slate-900 text-lg font-semibold disabled:opacity-60"
              aria-label="Enviar"
              title="Enviar"
            >
              ↑
            </button>
          )}
        </div>
      </form>

      {/* Rodapé */}
      <div className="w-full bg-[#2b4e67] text-white text-[12px] leading-snug text-center px-4 py-3">
        <p className="mx-auto">
          IMPORTANTE: O Publ.IA é uma ferramenta de apoio técnico e informativo. Não substitui a assessoria jurídica,
          contábil ou de controle interno. As informações são baseadas na legislação vigente e devem ser revisadas
          antes de uso oficial - Nexus Pública @2026 - Todos os direitos reservados |{" "}
          <a
            href="https://www.nexuspublica.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="underline ml-1"
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
            Sobre o Publ.IA
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
