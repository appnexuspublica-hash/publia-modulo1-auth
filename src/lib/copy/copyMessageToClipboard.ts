// src/lib/copy/copyMessageToClipboard.ts
export async function copyMessageToClipboard(messageId: string) {
  const root = document.querySelector(
    `[data-copy-id="${messageId}"]`
  ) as HTMLElement | null;

  if (!root) throw new Error("Mensagem não encontrada para copiar.");

  // Clona só o conteúdo markdown renderizado
  const clone = root.cloneNode(true) as HTMLElement;

  // 1) Remove hyperlinks (troca <a> por <span>) para evitar “azul” no Word/Docs
  clone.querySelectorAll("a").forEach((a) => {
    const span = document.createElement("span");
    const text = (a.textContent || "").trim();
    const href = a.getAttribute("href");

    // Se quiser manter o URL, descomente:
    // span.textContent = href ? `${text} (${href})` : text;

    span.textContent = text;
    a.replaceWith(span);
  });

  // 2) Estilo inline p/ colar “bonito” (tabelas) e tudo PRETO
  //    Word/Docs ignoram classes do Tailwind, então inline é o que manda
  clone.querySelectorAll<HTMLElement>("*").forEach((el) => {
    el.style.color = "#000";
    el.style.background = "transparent";
  });

  clone.querySelectorAll<HTMLTableElement>("table").forEach((t) => {
    t.style.borderCollapse = "collapse";
    t.style.width = "100%";
  });

  clone.querySelectorAll<HTMLElement>("th, td").forEach((cell) => {
    cell.style.border = "1px solid #999";
    cell.style.padding = "6px 8px";
    cell.style.verticalAlign = "top";
    cell.style.color = "#000";
  });

  // 3) Monta HTML final
  const html = `
<div style="color:#000;font-family:Arial, sans-serif;font-size:12pt;line-height:1.5;">
  ${clone.innerHTML}
</div>`.trim();

  const text = (clone.innerText || "").trim();

  // 4) Copia preferindo HTML+Plain (melhor para tabelas)
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
  } catch {
    // Fallback (sem tabelas ricas)
    await navigator.clipboard.writeText(text);
  }
}
