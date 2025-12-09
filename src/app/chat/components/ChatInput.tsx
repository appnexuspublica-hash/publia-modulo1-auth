// src/app/chat/components/ChatInput.tsx
"use client";

import React, {
  useState,
  useRef,
  KeyboardEvent,
  FormEvent,
  ChangeEvent,
} from "react";

type ChatInputProps = {
  onSend: (message: string) => void | Promise<void>;
  disabled?: boolean;
};

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function autoResize(el: HTMLTextAreaElement) {
    const maxHeight = 120; // altura máxima em px (~5–6 linhas)
    el.style.height = "0px";
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = newHeight + "px";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    await onSend(trimmed);
    setValue("");

    // volta para altura mínima
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    autoResize(e.target);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sozinho envia a mensagem
    // Shift+Enter quebra linha
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSend(trimmed);
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "40px";
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Linha do input + botão enviar */}
      <form onSubmit={handleSubmit} className="flex justify-center">
        <div className="flex w-full max-w-3xl items-center rounded-2xl bg-white px-4 py-2 shadow-md">
          <textarea
            ref={textareaRef}
            placeholder="Envie sua pergunta..."
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 resize-none overflow-y-auto border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 leading-normal"
            disabled={disabled}
          />

          <button
            type="submit"
            disabled={disabled}
            className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#ffae00] text-slate-900 text-lg font-semibold disabled:opacity-60"
          >
            ↑
          </button>
        </div>
      </form>

      {/* Rodapé em uma linha só */}
      <div className="w-full bg-[#2b4e67] text-white text-[12px] leading-snug text-center px-4 py-3">
  <p className="mx-auto">
    IMPORTANTE: O Publ.IA é uma ferramenta de apoio técnico e informativo.
    Não substitui a assessoria jurídica, contábil ou de controle interno.
    As informações são baseadas na legislação vigente e devem ser
    revisadas antes de uso oficial - Nexus Pública @2025 - Todos os direitos reservados |  
    <a 
      href="https://www.nexuspublica.com.br"
      target="_blank"
      rel="noopener nreferrer"
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
