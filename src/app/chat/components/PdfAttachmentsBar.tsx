// src/app/chat/components/PdfAttachmentsBar.tsx
"use client";

import React from "react";

export type PdfFile = {
  id: string;
  file_name: string;
  created_at?: string;
  file_size_kb?: number;
  // storage_path?: string; // podemos usar depois se quiser link para download
};

type PdfAttachmentsBarProps = {
  pdfs: PdfFile[];
  onUploadClick: () => void;
  onRemovePdf: (id: string) => void;
};

export function PdfAttachmentsBar({
  pdfs,
  onUploadClick,
  onRemovePdf,
}: PdfAttachmentsBarProps) {
  const hasPdfs = pdfs && pdfs.length > 0;

  return (
    <div className="px-8 pt-2 pb-1">
      {/* Botão simples "Anexar PDF" alinhado com o chat */}
      <div className="w-full max-w-3xl mx-auto flex justify-start">
        <button
          type="button"
          onClick={onUploadClick}
          className="inline-flex items-center rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
        >
          Anexar PDF
        </button>
      </div>

      {/* Chips de PDFs anexados (quando houver) */}
      {hasPdfs && (
        <div className="mt-2 w-full max-w-3xl mx-auto flex flex-wrap gap-2">
          {pdfs.map((pdf) => (
            <div
              key={pdf.id}
              className="inline-flex items-center gap-2 rounded-full bg-[#1b2c3a] px-3 py-1 text-[11px] text-slate-100"
            >
              <span className="max-w-[160px] truncate" title={pdf.file_name}>
                {pdf.file_name}
              </span>
              {pdf.file_size_kb && (
                <span className="text-[10px] text-slate-300">
                  ~{pdf.file_size_kb} KB
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemovePdf(pdf.id)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] font-bold hover:border-red-500 hover:bg-red-500 hover:text-white"
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
