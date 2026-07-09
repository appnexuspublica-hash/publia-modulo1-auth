// src/app/governanca/configuracoes/GovernanceSettingsClient.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, CheckCircle2, ImageUp, Loader2, Settings } from "lucide-react";

type GovernanceSettingsClientProps = {
  organizationId: string;
  organizationName: string;
  currentLogoUrl: string | null;
};

type UploadState = {
  type: "success" | "error";
  message: string;
} | null;

export default function GovernanceSettingsClient({
  organizationId,
  organizationName,
  currentLogoUrl,
}: GovernanceSettingsClientProps) {
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>(null);
  const [isPending, startTransition] = useTransition();

  const previewUrl = useMemo(() => {
    if (!selectedFile) {
      return null;
    }

    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setUploadState(null);
    setSelectedFile(file);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadState(null);

    if (!selectedFile) {
      setUploadState({
        type: "error",
        message: "Selecione uma imagem para enviar.",
      });
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setUploadState({
        type: "error",
        message: "Envie apenas arquivos de imagem.",
      });
      return;
    }

    if (selectedFile.size > 2 * 1024 * 1024) {
      setUploadState({
        type: "error",
        message: "A imagem deve ter no máximo 2 MB.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("organizationId", organizationId);
        formData.append("logo", selectedFile);

        const response = await fetch("/api/governance/settings/logo", {
          method: "POST",
          body: formData,
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível enviar a logo.");
        }

        setLogoUrl(payload.logoUrl);
        setSelectedFile(null);
        setUploadState({
          type: "success",
          message: "Logo do órgão atualizada com sucesso.",
        });

        window.setTimeout(() => {
          window.location.reload();
        }, 900);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao enviar a logo.";

        setUploadState({
          type: "error",
          message,
        });
      }
    });
  }

  const visibleLogoUrl = previewUrl ?? logoUrl;

  return (
    <section className="rounded-3xl border border-[#dedede] bg-white p-7 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
            <Settings size={22} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Configurações do órgão
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Atualize a identidade visual exibida no painel do Publ.IA
              Governança. Nesta etapa, a configuração disponível é a logo do
              órgão no card lateral.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-[#dedede] bg-[#f8f8f8] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0f3a4a]">
            Pré-visualização
          </p>

          <div className="mt-4 rounded-3xl border border-[#dedede] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#dedede] bg-[#f8f8f8] text-[#0f3a4a]">
                {visibleLogoUrl ? (
                  <img
                    src={visibleLogoUrl}
                    alt={`Logo de ${organizationName}`}
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <Building2 size={26} />
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0f3a4a]">
                  Órgão
                </p>
                <h2 className="mt-1 line-clamp-3 text-base font-bold text-slate-950">
                  {organizationName}
                </h2>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Essa é a aparência aproximada do card lateral após salvar.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-[#dedede] bg-[#f8f8f8] p-5"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0f3a4a]">
              <ImageUp size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Enviar logo do órgão
              </h2>
              <p className="text-sm text-slate-600">
                Use PNG, JPG, WEBP ou SVG com até 2 MB.
              </p>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase text-slate-500">
              Arquivo da logo
            </span>

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileChange}
              className="block w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-[#0f3a4a] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
            />
          </label>

          {selectedFile && (
            <div className="mt-4 rounded-2xl border border-[#dedede] bg-white p-4 text-sm text-slate-700">
              <p>
                <strong>Arquivo selecionado:</strong> {selectedFile.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Tamanho: {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          )}

          {uploadState && (
            <div
              className={[
                "mt-4 rounded-2xl border px-4 py-3 text-sm",
                uploadState.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700",
              ].join(" ")}
            >
              {uploadState.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f3a4a] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            Salvar logo do órgão
          </button>
        </form>
      </div>
    </section>
  );
}
