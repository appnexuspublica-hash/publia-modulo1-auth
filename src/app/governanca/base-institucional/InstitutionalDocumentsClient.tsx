// src/app/governanca/base-institucional/InstitutionalDocumentsClient.tsx
"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Edit3,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import type { GovernanceInstitutionalDocument } from "@/types/governance";

type InstitutionalDocumentsClientProps = {
  initialDocuments: GovernanceInstitutionalDocument[];
};

type Feedback = {
  type: "success" | "error";
  message: string;
} | null;

type EditingDocument = {
  id: string;
  title: string;
  documentType: string;
  sourceUrl: string;
  validFrom: string;
  validUntil: string;
  reviewStatus: string;
};

const documentTypes = [
  { value: "codigo", label: "Código" },
  { value: "decreto", label: "Decreto" },
  { value: "estatuto", label: "Estatuto" },
  { value: "instrucao_normativa", label: "Instrução Normativa" },
  { value: "lei", label: "Lei" },
  { value: "manual", label: "Manual" },
  { value: "organograma", label: "Organograma" },
  { value: "outro", label: "Outro" },
  { value: "parecer_juridico", label: "Parecer Jurídico" },
  { value: "plano", label: "Plano" },
  { value: "portaria", label: "Portaria" },
  { value: "recomendacoes_mp", label: "Recomendações do MP" },
  { value: "resolucao", label: "Resolução" },
];

const reviewStatuses = [
  { value: "draft", label: "Rascunho" },
  { value: "pending_review", label: "Pendente de revisão" },
  { value: "approved", label: "Ativo / aprovado" },
  { value: "rejected", label: "Rejeitado" },
  { value: "archived", label: "Inativo / arquivado" },
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

function toDateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
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

function getDocumentTypeLabel(value: string) {
  const labels: Record<string, string> = {
    ata: "Ata",
    codigo: "Código",
    contrato: "Contrato",
    decreto: "Decreto",
    decreto_consolidado: "Decreto",
    edital: "Edital",
    estatuto: "Estatuto",
    instrucao_normativa: "Instrução Normativa",
    lei: "Lei",
    lei_organica: "Lei",
    manual: "Manual",
    norma_interna: "Instrução Normativa",
    organograma: "Organograma",
    outro: "Outro",
    parecer: "Parecer Jurídico",
    parecer_juridico: "Parecer Jurídico",
    parecer_modelo: "Parecer Jurídico",
    plano: "Plano",
    portaria: "Portaria",
    recomendacoes_mp: "Recomendações do MP",
    regulamento: "Regulamento",
    resolucao: "Resolução",
  };

  return labels[value] ?? "Documento";
}

function getReviewStatusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    pending: "Pendente",
    pending_review: "Pendente de revisão",
    approved: "Ativo",
    rejected: "Rejeitado",
    archived: "Inativo",
  };

  return labels[value] ?? "Pendente";
}

function getIndexingStatusLabel(value: string) {
  const labels: Record<string, string> = {
    not_indexed: "Não indexado",
    pending: "Pendente",
    processing: "Processando",
    indexed: "Indexado",
    failed: "Falhou",
    error: "Erro",
  };

  return labels[value] ?? "Pendente";
}

function isDocumentApproved(document: GovernanceInstitutionalDocument) {
  return String(document.review_status) === "approved";
}

function isDocumentArchived(document: GovernanceInstitutionalDocument) {
  return String(document.review_status) === "archived";
}

function isDocumentIndexed(document: GovernanceInstitutionalDocument) {
  return String(document.indexing_status) === "indexed";
}

function getExtractionMessage(document: GovernanceInstitutionalDocument) {
  const metadata = document.metadata ?? {};
  const message = metadata.extraction_message;

  if (String(document.indexing_status) === "indexed") {
    if (String(document.review_status) === "approved") {
      return "Documento ativo, indexado e disponível para consulta no Chat.";
    }

    return "Documento indexado. Ative após a revisão para liberar a consulta no Chat.";
  }

  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function normalizeDocumentForEdit(
  document: GovernanceInstitutionalDocument,
): EditingDocument {
  return {
    id: document.id,
    title: document.title,
    documentType: String(document.document_type ?? "outro"),
    sourceUrl: document.source_url ?? "",
    validFrom: toDateInputValue(document.valid_from),
    validUntil: toDateInputValue(document.valid_until),
    reviewStatus: String(document.review_status ?? "pending_review"),
  };
}

export default function InstitutionalDocumentsClient({
  initialDocuments,
}: InstitutionalDocumentsClientProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] =
    useState<EditingDocument | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [documentFeedback, setDocumentFeedback] = useState<
    Record<string, NonNullable<Feedback>>
  >({});

  const totalDocuments = documents.length;

  const latestDocuments = useMemo(
    () =>
      documents
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [documents],
  );

  function updateDocumentInState(document: GovernanceInstitutionalDocument) {
    setDocuments((current) =>
      current.map((item) => (item.id === document.id ? document : item)),
    );
  }

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
        message:
          "Documento cadastrado em revisão. Depois de conferir, clique em Ativar para liberar o uso no Chat Governança.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao cadastrar documento.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDocumentAction(
    documentId: string,
    action: "approve" | "archive" | "restore" | "reprocess",
  ) {
    if (busyDocumentId) return;

    setBusyDocumentId(documentId);
    setDocumentFeedback((current) => {
      const next = { ...current };
      delete next[documentId];
      return next;
    });

    try {
      const response = await fetch("/api/governance/institutional-documents", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: documentId,
          action,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível atualizar.");
      }

      updateDocumentInState(payload.document as GovernanceInstitutionalDocument);

      const messages: Record<typeof action, string> = {
        approve: "Documento ativado/aprovado.",
        archive: "Documento inativado/arquivado.",
        restore: "Documento restaurado para revisão.",
        reprocess: "Documento reprocessado.",
      };

      setDocumentFeedback((current) => ({
        ...current,
        [documentId]: {
          type: "success",
          message: messages[action],
        },
      }));
    } catch (error) {
      setDocumentFeedback((current) => ({
        ...current,
        [documentId]: {
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao atualizar documento.",
        },
      }));
    } finally {
      setBusyDocumentId(null);
    }
  }

  async function handleDeleteDocument(document: GovernanceInstitutionalDocument) {
    if (busyDocumentId) return;

    const isArchived = String(document.review_status) === "archived";

    if (!isArchived) {
      setDocumentFeedback((current) => ({
        ...current,
        [document.id]: {
          type: "error",
          message:
            "Para proteger a base institucional, arquive o documento antes de excluir definitivamente.",
        },
      }));
      return;
    }

    const confirmed = window.confirm(
      "Excluir definitivamente este documento arquivado do banco e do Storage?",
    );

    if (!confirmed) return;

    setBusyDocumentId(document.id);
    setDocumentFeedback((current) => {
      const next = { ...current };
      delete next[document.id];
      return next;
    });

    try {
      const response = await fetch(
        `/api/governance/institutional-documents?id=${encodeURIComponent(
          document.id,
        )}`,
        {
          method: "DELETE",
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Não foi possível excluir o documento.",
        );
      }

      setDocuments((current) => current.filter((item) => item.id !== document.id));

      if (editingDocument?.id === document.id) {
        setEditingDocument(null);
      }

      setDocumentFeedback((current) => ({
        ...current,
        [document.id]: {
          type: "success",
          message: "Documento excluído definitivamente.",
        },
      }));
    } catch (error) {
      setDocumentFeedback((current) => ({
        ...current,
        [document.id]: {
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao excluir documento.",
        },
      }));
    } finally {
      setBusyDocumentId(null);
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingDocument || busyDocumentId) return;

    setBusyDocumentId(editingDocument.id);
    setDocumentFeedback((current) => {
      const next = { ...current };
      delete next[editingDocument.id];
      return next;
    });

    try {
      const response = await fetch("/api/governance/institutional-documents", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingDocument.id,
          action: "update",
          title: editingDocument.title,
          documentType: editingDocument.documentType,
          category: "",
          sourceName: "",
          sourceUrl: editingDocument.sourceUrl,
          validFrom: editingDocument.validFrom,
          validUntil: editingDocument.validUntil,
          reviewStatus: editingDocument.reviewStatus,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível salvar a edição.");
      }

      updateDocumentInState(payload.document as GovernanceInstitutionalDocument);
      setEditingDocument(null);

      setDocumentFeedback((current) => ({
        ...current,
        [editingDocument.id]: {
          type: "success",
          message: "Documento atualizado com sucesso.",
        },
      }));
    } catch (error) {
      setDocumentFeedback((current) => ({
        ...current,
        [editingDocument.id]: {
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao salvar edição.",
        },
      }));
    } finally {
      setBusyDocumentId(null);
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
              Cadastre o documento institucional. O reprocessamento extrai o
              texto para uso futuro no Chat Governança.
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
              placeholder="Ex.: Lei Municipal"
              className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
            />
          </div>

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
              Arquivo *
            </label>
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              className="w-full rounded-2xl border border-dashed border-[#bcbcbc] bg-[#f8f8f8] px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-[#0f3a4a] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              O limite padrão é 120 MB, seguindo a configuração atual do
              Governança.
            </p>
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

      <section className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
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
            {latestDocuments.map((document) => {
              const extractionMessage = getExtractionMessage(document);
              const isBusy = busyDocumentId === document.id;
              const isArchived = isDocumentArchived(document);
              const isApproved = isDocumentApproved(document);
              const isIndexed = isDocumentIndexed(document);
              const canActivate = !isApproved && !isArchived && isIndexed;
              const canArchive = isApproved;
              const canDelete = isArchived;

              return (
                <article
                  key={document.id}
                  className={[
                    "rounded-3xl border p-5",
                    isArchived
                      ? "border-slate-200 bg-slate-100 opacity-80"
                      : "border-[#dedede] bg-[#f8f8f8]",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
                          Tipo: {getDocumentTypeLabel(String(document.document_type))}
                        </span>

                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          Status: {getReviewStatusLabel(String(document.review_status))}
                        </span>

                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          Pesquisa IA:{" "}
                          {getIndexingStatusLabel(
                            String(document.indexing_status),
                          )}
                        </span>
                      </div>

                      <h3 className="truncate text-base font-bold text-slate-950">
                        {document.title}
                      </h3>

                      <p className="mt-1 text-sm text-slate-600">
                        {document.file_name || "Arquivo não informado"}
                      </p>

                      {extractionMessage ? (
                        <p className="mt-3 min-h-[4.5rem] max-w-full rounded-2xl bg-white px-4 py-4 text-xs leading-6 text-slate-600 lg:w-[34rem]">
                          {extractionMessage}
                        </p>
                      ) : null}
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
                      <strong className="block text-slate-800">
                        Link da fonte
                      </strong>
                      {document.source_url ? (
                        <a
                          href={document.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-[#0f3a4a] underline"
                        >
                          {document.source_url}
                        </a>
                      ) : (
                        <span>Não informado</span>
                      )}
                    </div>

                    <div className="rounded-2xl bg-white p-3">
                      <strong className="block text-slate-800">Vigência</strong>
                      <span>
                        {formatDate(document.valid_from)} até{" "}
                        {formatDate(document.valid_until)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setDocumentFeedback((current) => {
                          const next = { ...current };
                          delete next[document.id];
                          return next;
                        });
                        setEditingDocument(normalizeDocumentForEdit(document));
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#dedede] bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Edit3 size={14} />
                      Editar
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        handleDocumentAction(document.id, "reprocess")
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#dedede] bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Reprocessar
                    </button>

                    {isArchived ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleDocumentAction(document.id, "restore")
                        }
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#dedede] bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RotateCcw size={14} />
                        Restaurar para revisão
                      </button>
                    ) : null}

                    {!isApproved && !isArchived ? (
                      <button
                        type="button"
                        disabled={isBusy || !canActivate}
                        title={
                          isIndexed
                            ? "Ativar documento revisado"
                            : "Reprocesse ou aguarde a indexação antes de ativar"
                        }
                        onClick={() =>
                          handleDocumentAction(document.id, "approve")
                        }
                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} />
                        Ativar
                      </button>
                    ) : null}

                    {canArchive ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleDocumentAction(document.id, "archive")
                        }
                        className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Archive size={14} />
                        Arquivar
                      </button>
                    ) : null}

                    <button
                      type="button"
                      disabled={isBusy || !canDelete}
                      title={
                        canDelete
                          ? "Excluir definitivamente"
                          : "Arquive o documento antes de excluir"
                      }
                      onClick={() => handleDeleteDocument(document)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  </div>

                  {documentFeedback[document.id] ? (
                    <div
                      className={[
                        "mt-4 rounded-2xl border p-4 text-sm",
                        documentFeedback[document.id].type === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border-red-200 bg-red-50 text-red-900",
                      ].join(" ")}
                    >
                      {documentFeedback[document.id].message}
                    </div>
                  ) : null}

        {editingDocument?.id === document.id ? (
          <form
            onSubmit={handleEditSubmit}
            className="mt-4 rounded-3xl border border-[#dedede] bg-white p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-slate-950">
                Editar documento
              </h3>

              <button
                type="button"
                onClick={() => setEditingDocument(null)}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#dedede] bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <X size={14} />
                Cancelar
              </button>
            </div>

            <div className="grid gap-4">
              <input
                value={editingDocument.title}
                onChange={(event) =>
                  setEditingDocument((current) =>
                    current
                      ? { ...current, title: event.target.value }
                      : current,
                  )
                }
                required
                className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <select
                  value={editingDocument.documentType}
                  onChange={(event) =>
                    setEditingDocument((current) =>
                      current
                        ? { ...current, documentType: event.target.value }
                        : current,
                    )
                  }
                  className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
                >
                  {documentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>

                <select
                  value={editingDocument.reviewStatus}
                  onChange={(event) =>
                    setEditingDocument((current) =>
                      current
                        ? { ...current, reviewStatus: event.target.value }
                        : current,
                    )
                  }
                  className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
                >
                  {reviewStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <input
                value={editingDocument.sourceUrl}
                onChange={(event) =>
                  setEditingDocument((current) =>
                    current
                      ? { ...current, sourceUrl: event.target.value }
                      : current,
                  )
                }
                placeholder="Link da fonte"
                className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={editingDocument.validFrom}
                  onChange={(event) =>
                    setEditingDocument((current) =>
                      current
                        ? { ...current, validFrom: event.target.value }
                        : current,
                    )
                  }
                  type="date"
                  className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
                />

                <input
                  value={editingDocument.validUntil}
                  onChange={(event) =>
                    setEditingDocument((current) =>
                      current
                        ? { ...current, validUntil: event.target.value }
                        : current,
                    )
                  }
                  type="date"
                  className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
                />
              </div>

              <button
                type="submit"
                disabled={busyDocumentId === editingDocument.id}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f3a4a] px-4 py-3 text-sm font-bold text-white hover:bg-[#145064] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyDocumentId === editingDocument.id ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Salvar edição
              </button>
            </div>
          </form>
        ) : null}


                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
