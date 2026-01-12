"use client";

import * as React from "react";

type Props = {
  targetId: string; // id do container que envolve as mensagens
  className?: string;
};

function stripControls(root: HTMLElement) {
  // Remove botões/inputs dentro do conteúdo (ex.: “Baixar CSV/Excel”, etc.)
  root.querySelectorAll("button, input, textarea, select").forEach((el) => el.remove());

  // Remove qualquer elemento explicitamente marcado como "não copiar"
  root.querySelectorAll('[data-no-copy="1"]').forEach((el) => el.remove());
}

function normalizeTablesForClipboard(root: HTMLElement) {
  // Tabelas
  const tables = Array.from(root.querySelectorAll("table"));
  for (const table of tables) {
    table.setAttribute(
      "style",
      [
        "border-collapse:collapse",
        "width:100%",
        "margin:10px 0",
        "font-size:13px",
        "color:#0f172a",
      ].join(";")
    );

    // thead/th
    const ths = Array.from(table.querySelectorAll("thead th, th"));
    for (const th of ths) {
      th.setAttribute(
        "style",
        [
          "border:1px solid #cbd5e1",
          "padding:6px 8px",
          "text-align:left",
          "vertical-align:top",
          "background:#f1f5f9",
          "font-weight:600",
          "color:#0f172a",
          "white-space:nowrap",
        ].join(";")
      );
    }

    // td
    const tds = Array.from(table.querySelectorAll("td"));
    for (const td of tds) {
      td.setAttribute(
        "style",
        [
          "border:1px solid #e2e8f0",
          "padding:6px 8px",
          "vertical-align:top",
          "color:#0f172a",
          "white-space:normal",
          "word-break:break-word",
        ].join(";")
      );
    }

    // linhas (caso editor respeite)
    const trs = Array.from(table.querySelectorAll("tr"));
    trs.forEach((tr, idx) => {
      tr.setAttribute(
        "style",
        [
          idx % 2 === 1 ? "background:#ffffff" : "background:#fbfdff",
        ].join(";")
      );
    });
  }
}

function normalizeTextForClipboard(root: HTMLElement) {
  // Força texto escuro (evita trechos azuis/brancos inesperados ao colar)
  const all = Array.from(root.querySelectorAll("*"));
  for (const el of all) {
    // não mexe em links por enquanto
    if (el.tagName.toLowerCase() === "a") continue;

    // Se vier com classes/estilos do tema dark, neutraliza
    const tag = el.tagName.toLowerCase();
    if (tag === "pre" || tag === "code") {
      // deixa código legível
      (el as HTMLElement).setAttribute(
        "style",
        [
          "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          "background:#f8fafc",
          "border:1px solid #e2e8f0",
          "border-radius:8px",
          "padding:10px",
          "color:#0f172a",
          "overflow:auto",
        ].join(";")
      );
    } else {
      const existing = (el as HTMLElement).getAttribute("style") || "";
      // garante cor escura sem destruir o resto
      if (!/color\s*:/.test(existing)) {
        (el as HTMLElement).setAttribute("style", `${existing};color:#0f172a;`);
      }
      // remove fundos “dark” (fica melhor em docs)
      if (!/background\s*:/.test(existing)) {
        (el as HTMLElement).setAttribute("style", `${(el as HTMLElement).getAttribute("style")};background:transparent;`);
      }
    }
  }

  // Links: deixam de ficar “azul padrão” se você quiser (opcional)
  // Se preferir manter azul, remova esse bloco.
  const links = Array.from(root.querySelectorAll("a"));
  for (const a of links) {
    a.setAttribute(
      "style",
      ["color:#0f172a", "text-decoration:underline"].join(";")
    );
  }
}

export default function CopyConversationButton({ targetId, className }: Props) {
  const [copied, setCopied] = React.useState(false);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  async function handleCopy() {
    setErrMsg(null);

    const el = document.getElementById(targetId);
    if (!el) {
      setErrMsg("Não encontrei o conteúdo para copiar.");
      return;
    }

    // Clona para não mexer no DOM real
    const clone = el.cloneNode(true) as HTMLElement;

    stripControls(clone);
    normalizeTablesForClipboard(clone);
    normalizeTextForClipboard(clone);

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color:#0f172a;">
        ${clone.innerHTML}
      </div>
    `.trim();

    const plain = (el.innerText || "").trim();

    try {
      // Clipboard com HTML + texto (quando suportado)
      // @ts-ignore
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        // @ts-ignore
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        });
        // @ts-ignore
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(plain);
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (e: any) {
      console.error("[share copy] erro ao copiar", e);

      // fallback final
      try {
        await navigator.clipboard.writeText(plain);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        setErrMsg("Não foi possível copiar. Verifique permissões do navegador.");
      }
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15"
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>

      {errMsg && <div className="mt-1 text-[11px] text-red-200/90">{errMsg}</div>}
    </div>
  );
}


