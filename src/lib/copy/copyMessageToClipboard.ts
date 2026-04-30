// src/lib/copy/copyMessageToClipboard.ts

function cleanPlainText(input: string) {
  return String(input ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .filter((line) => !/^\s*([-_*])\s*(\1\s*){2,}$/.test(line))
    .join("\n")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s*[-+*]\s+/gm, "• ")
    .replace(/^\s*•\s*/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removeEmptyDecorativeNodes(root: HTMLElement) {
  root.querySelectorAll("hr").forEach((el) => el.remove());

  root.querySelectorAll<HTMLElement>("p, div").forEach((el) => {
    const text = (el.textContent || "").trim();
    if (/^([-_*]\s*){3,}$/.test(text)) {
      el.remove();
    }
  });
}

function applyWordFriendlyStyles(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    el.style.color = "#000";
    el.style.background = "transparent";
    el.style.boxShadow = "none";
  });

  root.querySelectorAll<HTMLElement>("p").forEach((p) => {
    p.style.margin = "0 0 10pt 0";
  });

  root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6").forEach((h) => {
    h.style.margin = "14pt 0 8pt 0";
    h.style.fontWeight = "700";
    h.style.lineHeight = "1.25";
  });

  root.querySelectorAll<HTMLElement>("h1").forEach((h) => {
    h.style.fontSize = "18pt";
  });

  root.querySelectorAll<HTMLElement>("h2").forEach((h) => {
    h.style.fontSize = "15pt";
  });

  root.querySelectorAll<HTMLElement>("h3, h4, h5, h6").forEach((h) => {
    h.style.fontSize = "13pt";
  });

  root.querySelectorAll<HTMLElement>("ul, ol").forEach((list) => {
    list.style.margin = "0 0 10pt 22pt";
    list.style.padding = "0";
  });

  root.querySelectorAll<HTMLElement>("li").forEach((li) => {
    li.style.margin = "0 0 5pt 0";
    li.style.padding = "0";
  });

  root.querySelectorAll<HTMLElement>("strong, b").forEach((el) => {
    el.style.fontWeight = "700";
  });

  root.querySelectorAll<HTMLElement>("em, i").forEach((el) => {
    el.style.fontStyle = "italic";
  });

  root.querySelectorAll<HTMLElement>("blockquote").forEach((quote) => {
    quote.style.margin = "0 0 10pt 14pt";
    quote.style.padding = "0 0 0 10pt";
    quote.style.borderLeft = "3px solid #999";
  });

  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.style.margin = "10pt 0";
  });

  root.querySelectorAll<HTMLElement>("th, td").forEach((cell) => {
    cell.style.border = "1px solid #999";
    cell.style.padding = "6px 8px";
    cell.style.verticalAlign = "top";
    cell.style.color = "#000";
  });

  root.querySelectorAll<HTMLElement>("th").forEach((cell) => {
    cell.style.fontWeight = "700";
  });
}

function unwrapLinks(root: HTMLElement) {
  root.querySelectorAll("a").forEach((a) => {
    const span = document.createElement("span");
    span.textContent = (a.textContent || "").trim();
    a.replaceWith(span);
  });
}

export async function copyMessageToClipboard(messageId: string) {
  const root = document.querySelector(`[data-copy-id="${messageId}"]`) as HTMLElement | null;

  if (!root) throw new Error("Mensagem não encontrada para copiar.");

  const clone = root.cloneNode(true) as HTMLElement;

  clone.querySelectorAll("script, style, button").forEach((el) => el.remove());
  clone.querySelectorAll("[data-copy-exclude='true']").forEach((el) => el.remove());

  unwrapLinks(clone);
  removeEmptyDecorativeNodes(clone);
  applyWordFriendlyStyles(clone);

  const html = `
<div style="color:#000;font-family:Arial, sans-serif;font-size:12pt;line-height:1.45;">
  ${clone.innerHTML}
</div>`.trim();

  const text = cleanPlainText(clone.innerText || clone.textContent || "");

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}
