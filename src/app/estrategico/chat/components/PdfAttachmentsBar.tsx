// src/app/estrategico/chat/components/PdfAttachmentsBar.tsx
"use client";

import React from "react";

export type PdfFile = {
  id: string;
  file_name: string;
  created_at?: string;
  file_size_kb?: number;
};

type PdfAttachmentsBarProps = {
  pdfs: PdfFile[];
  onUploadClick: () => void;
  onRemovePdf: (id: string) => void;
  maxPdfsPerConversation?: number | null;
};

export function PdfAttachmentsBar({
  pdfs,
  onUploadClick,
  onRemovePdf,
  maxPdfsPerConversation = null,
}: PdfAttachmentsBarProps) {
  const hasPdfs = pdfs && pdfs.length > 0;

  return (
    <div className="px-8 pb-1 pt-2">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <button
          type="button"
          onClick={onUploadClick}
          className="inline-flex items-center rounded-full border border-[#0D2B4D]/25 bg-white px-4 py-1.5 text-xs font-semibold text-[#0D2B4D] shadow-sm transition hover:border-[#14933D]/40 hover:bg-[#14933D]/5 hover:text-[#14933D]"
        >
          Anexar PDF
        </button>

        {typeof maxPdfsPerConversation === "number" && (
          <span className="text-[11px] text-[#5A5A5A]">
            Limite por conversa: {maxPdfsPerConversation} PDF
            {maxPdfsPerConversation === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {hasPdfs && (
        <div className="mx-auto mt-2 flex w-full max-w-3xl flex-wrap gap-2">
          {pdfs.map((pdf) => (
            <div
              key={pdf.id}
              className="inline-flex items-center gap-2 rounded-full border border-[#0D2B4D]/15 bg-white px-3 py-1 text-[11px] text-[#0D2B4D] shadow-sm"
            >
              <span className="max-w-[160px] truncate font-medium" title={pdf.file_name}>
                {pdf.file_name}
              </span>

              {pdf.file_size_kb ? (
                <span className="text-[10px] text-[#5A5A5A]">
                  ~{pdf.file_size_kb} KB
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => onRemovePdf(pdf.id)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#0D2B4D]/30 text-[10px] font-bold text-[#5A5A5A] transition hover:border-red-500 hover:bg-red-500 hover:text-white"
                aria-label={`Remover ${pdf.file_name}`}
                title="Remover PDF"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
