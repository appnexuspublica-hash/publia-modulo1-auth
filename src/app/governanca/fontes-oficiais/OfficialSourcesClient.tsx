// src/app/governanca/fontes-oficiais/OfficialSourcesClient.tsx
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ExternalLink, FileSearch, Landmark, Link2, PlusCircle } from "lucide-react";

import type {
  GovernanceOfficialSource,
  GovernanceOfficialSourceType,
} from "@/types/governance";
import {
  getGovernanceOfficialSourceStatusLabel,
  getGovernanceOfficialSourceTypeLabel,
} from "@/types/governance";

type OfficialSourcesClientProps = {
  organizationName: string;
  canManage: boolean;
};

type FormState = {
  name: string;
  sourceType: GovernanceOfficialSourceType;
  url: string;
  notes: string;
};

const initialFormState: FormState = {
  name: "",
  sourceType: "municipal_website",
  url: "",
  notes: "",
};

const sourceTypeOptions: Array<{
  value: GovernanceOfficialSourceType;
  label: string;
}> = [
  { value: "municipal_website", label: "Site municipal" },
  { value: "official_gazette", label: "Diário oficial" },
  { value: "transparency_portal", label: "Portal da transparência" },
  { value: "institutional_repository", label: "Repositório institucional" },
  { value: "other", label: "Outra fonte" },
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

function normalizeUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
}

export default function OfficialSourcesClient({
  organizationName,
  canManage,
}: OfficialSourcesClientProps) {
  const [sources, setSources] = useState<GovernanceOfficialSource[]>([]);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeSourcesCount = useMemo(() => {
    return sources.filter((source) => source.status === "active").length;
  }, [sources]);

  async function loadSources() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/governance/official-sources", {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível listar as fontes.");
      }

      setSources(data.sources ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível listar as fontes oficiais.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");

    if (!canManage) {
      setErrorMessage("Seu perfil não pode gerenciar fontes oficiais.");
      return;
    }

    const normalizedUrl = normalizeUrl(formState.url);

    if (!formState.name.trim()) {
      setErrorMessage("Informe o nome da fonte oficial.");
      return;
    }

    if (!normalizedUrl) {
      setErrorMessage("Informe a URL da fonte oficial.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/governance/official-sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formState.name.trim(),
          sourceType: formState.sourceType,
          url: normalizedUrl,
          notes: formState.notes.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível cadastrar a fonte.");
      }

      setSources((currentSources) => [data.source, ...currentSources]);
      setFormState(initialFormState);
      setSuccessMessage("Fonte oficial cadastrada com sucesso.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar a fonte oficial.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-[#dedede] bg-white p-7 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
              <FileSearch size={14} />
              Fontes oficiais
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Fontes oficiais
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Cadastre portais, diários oficiais, repositórios e sites
              institucionais utilizados como referência oficial pelo órgão.
              Todos os registros ficam isolados pelo organization_id da
              organização atual.
            </p>
          </div>

          <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-[#0f3a4a]">{organizationName}</p>
            <p className="mt-1">{sources.length} fonte(s) cadastrada(s)</p>
            <p className="mt-1">{activeSourcesCount} fonte(s) ativa(s)</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <article className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
              <PlusCircle size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Cadastrar fonte
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Registre uma fonte oficial para curadoria institucional e uso
                futuro pelo Chat Governança.
              </p>
            </div>
          </div>

          {successMessage ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMessage}
            </div>
          ) : null}

          {!canManage ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              Seu perfil pode consultar as fontes oficiais, mas não pode
              cadastrar novas fontes.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="source-name"
                  className="mb-2 block text-sm font-semibold text-slate-950"
                >
                  Nome da fonte *
                </label>
                <input
                  id="source-name"
                  type="text"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Portal da Transparência"
                  className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#0f3a4a]"
                />
              </div>

              <div>
                <label
                  htmlFor="source-type"
                  className="mb-2 block text-sm font-semibold text-slate-950"
                >
                  Tipo *
                </label>
                <select
                  id="source-type"
                  value={formState.sourceType}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      sourceType: event.target
                        .value as GovernanceOfficialSourceType,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
                >
                  {sourceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="source-url"
                  className="mb-2 block text-sm font-semibold text-slate-950"
                >
                  URL *
                </label>
                <input
                  id="source-url"
                  type="url"
                  value={formState.url}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      url: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#0f3a4a]"
                />
              </div>

              <div>
                <label
                  htmlFor="source-notes"
                  className="mb-2 block text-sm font-semibold text-slate-950"
                >
                  Observações
                </label>
                <textarea
                  id="source-notes"
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      notes: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Ex.: Fonte oficial usada para consultas de legislação municipal."
                  className="w-full resize-none rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#0f3a4a]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#0f3a4a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123f51] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Cadastrando..." : "Cadastrar fonte oficial"}
              </button>
            </form>
          )}
        </article>

        <article className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
              <Landmark size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Fontes cadastradas
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {sources.length} fonte(s) oficial(is) cadastrada(s).
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-3xl border border-dashed border-[#cfcfcf] bg-[#f8f8f8] p-8 text-center text-sm text-slate-600">
              Carregando fontes oficiais...
            </div>
          ) : sources.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#cfcfcf] bg-[#f8f8f8] p-8 text-center">
              <p className="font-bold text-slate-950">
                Nenhuma fonte oficial cadastrada
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Cadastre a primeira fonte para estruturar a curadoria oficial do
                órgão.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-3xl border border-[#dedede] bg-[#f8f8f8] p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
                          {getGovernanceOfficialSourceTypeLabel(
                            source.source_type,
                          )}
                        </span>

                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {getGovernanceOfficialSourceStatusLabel(
                            source.status,
                          )}
                        </span>
                      </div>

                      <h3 className="break-words text-base font-bold text-slate-950">
                        {source.name}
                      </h3>

                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex max-w-full items-center gap-2 break-all text-sm font-semibold text-[#0f3a4a] hover:underline"
                      >
                        <Link2 size={15} />
                        {source.url}
                        <ExternalLink size={14} />
                      </a>

                      {source.notes ? (
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {source.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0 rounded-2xl bg-white px-4 py-3 text-xs leading-5 text-slate-700">
                      <p>
                        <strong>Cadastrada:</strong>{" "}
                        {formatDate(source.created_at)}
                      </p>
                      <p>
                        <strong>Revisada:</strong>{" "}
                        {formatDate(source.reviewed_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
