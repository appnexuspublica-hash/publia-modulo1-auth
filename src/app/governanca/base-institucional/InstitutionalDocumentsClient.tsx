// src/app/governanca/base-institucional/InstitutionalDocumentsClient.tsx
"use client";

import { FormEvent, useMemo, useState } from "react";
import { FileText, Loader2, Plus, UploadCloud } from "lucide-react";

import {
  getGovernanceInstitutionalDocumentIndexingStatusLabel,
  getGovernanceInstitutionalDocumentReviewStatusLabel,
  getGovernanceInstitutionalDocumentTypeLabel,
  type GovernanceInstitutionalDocument,
  type GovernanceInstitutionalDocumentType,
} from "@/types/governance";

type InstitutionalDocumentsClientProps = {
  initialDocuments: GovernanceInstitutionalDocument[];
};

const documentTypes: Array<{
  value: GovernanceInstitutionalDocumentType;
  label: string;
}> = [
  { value: "lei", label: "Lei" },
  { value: "decreto", label: "Decreto" },
  { value: "portaria", label: "Portaria" },
  { value: "parecer", label: "Parecer" },
  { value: "regulamento", label: "Regulamento" },
  { value: "norma_interna", label: "Norma interna" },
  { value: "manual", label: "Manual" },
  { value: "outro", label: "Outro" },
];

function formatDate(value: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(date);
}

function formatFileSize(value: number | null) {
  if (!value || value <= 0) return "Não informado";

  const megabytes = value / 1024 / 1024;

  if (megabytes >= 1) {
    return `${megabytes.toFixed(2).replace(".", ",")} MB`;
  }

  const kilobytes = value / 1024;
  return `${kilobytes.toFixed(1).replace(".", ",")} KB`;
}

export default function InstitutionalDocumentsClient({
  initialDocuments,
}: InstitutionalDocumentsClientProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const totalDocuments = documents.length;

  const latestDocuments = useMemo(
    () => documents.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [documents],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/governance/institutional-documents", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Não foi possível cadastrar o documento.",
        );
      }

      setDocuments((current) => [
        payload.document as GovernanceInstitutionalDocument,
        ...current,
      ]);

      form.reset();

      setFeedback({
        type: "success",
        message: "Documento institucional cadastrado com sucesso.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro inesperado ao cadastrar documento.";

      setFeedback({
        type: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
      <section className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
            <UploadCloud size={22} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Enviar documento
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Cadastre o documento e envie o arquivo para o Storage do Supabase.
              Nesta etapa, o arquivo é registrado para futura indexação e uso
              pelo Chat Governança.
            </p>
          </div>
        </div>

        {feedback ? (
          <div
            className={[
              "mb-5 rounded-2xl border p-4 text-sm",
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900",
            ].join(" ")}
          >
            {feedback.message}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-800">
              Título *
            </label>
            <input
              name="title"
              required
              placeholder="Ex.: Lei Orgânica Municipal"
              className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                Tipo *
              </label>
              <select
                name="documentType"
                required
                defaultValue="lei"
                className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
              >
                {documentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                Categoria
              </label>
              <input
                name="category"
                placeholder="Ex.: Licitações"
                className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-800">
              Arquivo *
            </label>
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.txt,.md,.rtf,application/pdf"
              className="w-full rounded-2xl border border-dashed border-[#bcbcbc] bg-[#f8f8f8] px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-[#0f3a4a] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              O limite padrão é 120 MB, seguindo a configuração atual do
              Governança.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                Fonte
              </label>
              <input
                name="sourceName"
                placeholder="Ex.: Diário Oficial"
                className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                Link da fonte
              </label>
              <input
                name="sourceUrl"
                type="url"
                placeholder="https://..."
                className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                Vigente a partir de
              </label>
              <input
                name="validFrom"
                type="date"
                className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                Vigente até
              </label>
              <input
                name="validUntil"
                type="date"
                className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f3a4a] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#145064] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Enviando...
              </>
            ) : (
              <>
                <Plus size={18} />
                Cadastrar documento
              </>
            )}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
              <FileText size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Documentos cadastrados
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {totalDocuments} documento(s) na base institucional.
              </p>
            </div>
          </div>
        </div>

        {latestDocuments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#bcbcbc] bg-[#f8f8f8] p-8 text-center">
            <h3 className="text-base font-bold text-slate-950">
              Nenhum documento cadastrado
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Envie o primeiro documento institucional para começar a estruturar
              a base do órgão.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {latestDocuments.map((document) => (
              <article
                key={document.id}
                className="rounded-3xl border border-[#dedede] bg-[#f8f8f8] p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
                        {getGovernanceInstitutionalDocumentTypeLabel(
                          document.document_type,
                        )}
                      </span>

                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {getGovernanceInstitutionalDocumentReviewStatusLabel(
                          document.review_status,
                        )}
                      </span>

                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {getGovernanceInstitutionalDocumentIndexingStatusLabel(
                          document.indexing_status,
                        )}
                      </span>
                    </div>

                    <h3 className="truncate text-base font-bold text-slate-950">
                      {document.title}
                    </h3>

                    <p className="mt-1 text-sm text-slate-600">
                      {document.category || "Sem categoria"} ·{" "}
                      {document.file_name || "Arquivo não informado"}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-2xl bg-white px-4 py-3 text-xs text-slate-600">
                    <p>
                      <strong>Tamanho:</strong>{" "}
                      {formatFileSize(document.file_size)}
                    </p>
                    <p className="mt-1">
                      <strong>Cadastrado:</strong>{" "}
                      {formatDate(document.created_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-xs text-slate-600 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-3">
                    <strong className="block text-slate-800">Fonte</strong>
                    <span>{document.source_name || "Não informado"}</span>
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    <strong className="block text-slate-800">Vigência</strong>
                    <span>
                      {formatDate(document.valid_from)} até{" "}
                      {formatDate(document.valid_until)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
