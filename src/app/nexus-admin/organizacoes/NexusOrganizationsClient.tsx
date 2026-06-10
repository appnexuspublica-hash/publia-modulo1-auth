//src/app/nexus-admin/organizacoes/NexusOrganizationsClient.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Building2,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Plus,
  Power,
  PowerOff,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  getGovernanceHistoryRetentionPolicyLabel,
  getGovernanceMunicipalitySizeLabel,
  getGovernanceOrganizationTypeLabel,
  getOrganizationStatusLabel,
  type GovernanceFunctionalRole,
  type GovernanceHistoryRetentionPolicy,
  type GovernanceMunicipalitySize,
  type GovernanceOrganizationType,
  type OrganizationStatus,
} from "@/types/governance";

type OrganizationRow = {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string;
  slug: string;
  organization_type: GovernanceOrganizationType | null;
  municipality_name: string | null;
  state_uf: string | null;
  ibge_code: string | null;
  municipality_size: GovernanceMunicipalitySize | null;
  population: number | null;
  region: string | null;
  product_tier: "governance";
  status: OrganizationStatus;
  primary_color: string;
  logo_url: string | null;
  contract_reference: string | null;
  contract_starts_at: string | null;
  contract_ends_at: string | null;
  seats_limit: number | null;
  history_retention_policy: GovernanceHistoryRetentionPolicy | null;
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = "publia:nexus-admin:credentials";

const organizationTypeOptions: Array<{
  value: GovernanceOrganizationType;
  label: string;
}> = [
  { value: "prefeitura", label: "Prefeitura" },
  { value: "camara_municipal", label: "Câmara Municipal" },
  { value: "autarquia", label: "Autarquia" },
  { value: "fundacao", label: "Fundação" },
  { value: "consorcio_publico", label: "Consórcio Público" },
  { value: "instituto_previdencia", label: "Instituto/Previdência" },
  { value: "outro", label: "Outro" },
];

const municipalitySizeOptions: Array<{
  value: GovernanceMunicipalitySize;
  label: string;
}> = [
  { value: "small", label: "Pequeno — até 50 mil habitantes" },
  { value: "medium", label: "Médio — de 50 mil até 200 mil habitantes" },
  { value: "large", label: "Grande — acima de 200 mil habitantes" },
];

const historyRetentionPolicyOptions: Array<{
  value: GovernanceHistoryRetentionPolicy;
  label: string;
}> = [
  {
    value: "contract_duration",
    label: getGovernanceHistoryRetentionPolicyLabel("contract_duration"),
  },
];

const statusOptions: Array<{
  value: OrganizationStatus;
  label: string;
}> = [
  { value: "implementation", label: "Em implantação" },
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "suspended", label: "Suspenso" },
  { value: "archived", label: "Arquivado" },
];

const functionalRoleOptions: Array<{
  value: GovernanceFunctionalRole;
  label: string;
}> = [
  { value: "administrador", label: "Administrador" },
  { value: "gestor", label: "Gestor" },
  { value: "controle_interno", label: "Controle Interno" },
  { value: "juridico", label: "Jurídico" },
  { value: "contabilidade", label: "Contabilidade" },
  { value: "licitacoes", label: "Licitações" },
  { value: "servidor", label: "Servidor" },
  { value: "consultor", label: "Consultor" },
  { value: "outro", label: "Outro" },
];

const initialCreateForm = {
  name: "",
  legalName: "",
  cnpj: "",
  municipalityName: "",
  stateUf: "",
  ibgeCode: "",
  municipalitySize: "small" as GovernanceMunicipalitySize,
  population: "",
  region: "",
  contractReference: "",
  contractStartsAt: "",
  contractEndsAt: "",
  historyRetentionPolicy: "contract_duration" as GovernanceHistoryRetentionPolicy,
  organizationType: "prefeitura" as GovernanceOrganizationType,
  status: "implementation" as OrganizationStatus,
  seatsLimit: "10",
  ownerNome: "",
  ownerCpf: "",
  ownerPassword: "",
  ownerFunctionalRole: "administrador" as GovernanceFunctionalRole,
};

const initialEditForm = {
  id: "",
  name: "",
  legalName: "",
  cnpj: "",
  municipalityName: "",
  stateUf: "",
  ibgeCode: "",
  municipalitySize: "small" as GovernanceMunicipalitySize,
  population: "",
  region: "",
  contractReference: "",
  contractStartsAt: "",
  contractEndsAt: "",
  historyRetentionPolicy: "contract_duration" as GovernanceHistoryRetentionPolicy,
  organizationType: "prefeitura" as GovernanceOrganizationType,
  status: "implementation" as OrganizationStatus,
  seatsLimit: "",
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnpjInput(value: string) {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return digits.replace(/^(\d{2})(\d{1,3})$/, "$1.$2");
  if (digits.length <= 8) {
    return digits.replace(/^(\d{2})(\d{3})(\d{1,3})$/, "$1.$2.$3");
  }
  if (digits.length <= 12) {
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{1,4})$/,
      "$1.$2.$3/$4",
    );
  }

  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})$/,
    "$1.$2.$3/$4-$5",
  );
}

function formatCpfInput(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.replace(/^(\d{3})(\d{1,3})$/, "$1.$2");
  if (digits.length <= 9) {
    return digits.replace(/^(\d{3})(\d{3})(\d{1,3})$/, "$1.$2.$3");
  }

  return digits.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{1,2})$/,
    "$1.$2.$3-$4",
  );
}

function formatCnpj(value: string) {
  return formatCnpjInput(value);
}

function formatPopulation(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Não informado";
  }

  return new Intl.NumberFormat("pt-BR").format(value);
}

function getStatusBadgeClass(status: OrganizationStatus) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "implementation") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "inactive") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  if (status === "suspended") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function getStoredCredentials() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      user?: string;
      password?: string;
    };

    if (!parsed.user || !parsed.password) {
      return null;
    }

    return {
      user: parsed.user,
      password: parsed.password,
    };
  } catch {
    return null;
  }
}

export default function NexusOrganizationsClient() {
  const [credentials, setCredentials] = useState<{
    user: string;
    password: string;
  } | null>(null);
  const [loginUser, setLoginUser] = useState("nexus-admin");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const authHeaders: Record<string, string> = credentials
    ? {
        "x-nexus-admin-user": credentials.user,
        "x-nexus-admin-password": credentials.password,
      }
    : {};

  async function loadOrganizations(nextCredentials = credentials) {
    if (!nextCredentials) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/nexus-admin/organizations", {
        method: "GET",
        headers: {
          "x-nexus-admin-user": nextCredentials.user,
          "x-nexus-admin-password": nextCredentials.password,
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível listar.");
      }

      setOrganizations(payload.organizations ?? []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro inesperado ao carregar organizações.";

      setErrorMessage(message);
      setCredentials(null);
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const stored = getStoredCredentials();

    if (stored) {
      setCredentials(stored);
      void loadOrganizations(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextCredentials = {
      user: loginUser.trim(),
      password: loginPassword,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCredentials));
    setCredentials(nextCredentials);
    void loadOrganizations(nextCredentials);
  }

  function handleLogout() {
    window.localStorage.removeItem(STORAGE_KEY);
    setCredentials(null);
    setOrganizations([]);
    setLoginPassword("");
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function resetMessages() {
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();

    startTransition(async () => {
      try {
        const response = await fetch("/api/nexus-admin/organizations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            organization: {
              name: createForm.name,
              legalName: createForm.legalName,
              cnpj: onlyDigits(createForm.cnpj),
              municipalityName: createForm.municipalityName,
              stateUf: createForm.stateUf,
              ibgeCode: onlyDigits(createForm.ibgeCode),
              municipalitySize: createForm.municipalitySize,
              population: createForm.population
                ? Number(onlyDigits(createForm.population))
                : null,
              region: createForm.region,
              contractReference: createForm.contractReference,
              contractStartsAt: createForm.contractStartsAt,
              contractEndsAt: createForm.contractEndsAt,
              historyRetentionPolicy: createForm.historyRetentionPolicy,
              organizationType: createForm.organizationType,
              status: createForm.status,
              seatsLimit: createForm.seatsLimit
                ? Number(createForm.seatsLimit)
                : null,
            },
            owner: {
              nome: createForm.ownerNome,
              cpf: onlyDigits(createForm.ownerCpf),
              password: createForm.ownerPassword,
              functionalRole: createForm.ownerFunctionalRole,
            },
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível cadastrar.");
        }

        setCreateForm(initialCreateForm);
        setSuccessMessage(
          "Organização criada, Owner vinculado e acesso Governança liberado.",
        );

        await loadOrganizations();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao cadastrar organização.";

        setErrorMessage(message);
      }
    });
  }

  function startEdit(organization: OrganizationRow) {
    setEditingId(organization.id);
    setEditForm({
      id: organization.id,
      name: organization.name,
      legalName: organization.legal_name ?? "",
      cnpj: formatCnpj(organization.cnpj),
      municipalityName: organization.municipality_name ?? "",
      stateUf: organization.state_uf ?? "",
      ibgeCode: organization.ibge_code ?? "",
      municipalitySize: organization.municipality_size ?? "small",
      population:
        organization.population === null ? "" : String(organization.population),
      region: organization.region ?? "",
      contractReference: organization.contract_reference ?? "",
      contractStartsAt: organization.contract_starts_at
        ? organization.contract_starts_at.slice(0, 10)
        : "",
      contractEndsAt: organization.contract_ends_at
        ? organization.contract_ends_at.slice(0, 10)
        : "",
      historyRetentionPolicy:
        organization.history_retention_policy ?? "contract_duration",
      organizationType: organization.organization_type ?? "prefeitura",
      status: organization.status,
      seatsLimit:
        organization.seats_limit === null ? "" : String(organization.seats_limit),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(initialEditForm);
  }

  function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();

    startTransition(async () => {
      try {
        const response = await fetch("/api/nexus-admin/organizations", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            id: editForm.id,
            action: "update",
            organization: {
              name: editForm.name,
              legalName: editForm.legalName,
              cnpj: onlyDigits(editForm.cnpj),
              municipalityName: editForm.municipalityName,
              stateUf: editForm.stateUf,
              ibgeCode: onlyDigits(editForm.ibgeCode),
              municipalitySize: editForm.municipalitySize,
              population: editForm.population
                ? Number(onlyDigits(editForm.population))
                : null,
              region: editForm.region,
              contractReference: editForm.contractReference,
              contractStartsAt: editForm.contractStartsAt,
              contractEndsAt: editForm.contractEndsAt,
              historyRetentionPolicy: editForm.historyRetentionPolicy,
              organizationType: editForm.organizationType,
              status: editForm.status,
              seatsLimit: editForm.seatsLimit ? Number(editForm.seatsLimit) : null,
            },
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível atualizar.");
        }

        setSuccessMessage("Organização atualizada.");
        cancelEdit();
        await loadOrganizations();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao atualizar organização.";

        setErrorMessage(message);
      }
    });
  }

  function handleSetStatus(id: string, status: OrganizationStatus) {
    resetMessages();

    startTransition(async () => {
      try {
        const response = await fetch("/api/nexus-admin/organizations", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            id,
            action: "set-status",
            status,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível alterar status.");
        }

        setSuccessMessage(
          status === "active"
            ? "Organização ativada."
            : "Organização desativada.",
        );

        await loadOrganizations();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao alterar status.";

        setErrorMessage(message);
      }
    });
  }

  function handleDeleteOrganization(organization: OrganizationRow) {
    resetMessages();

    const confirmed = window.confirm(
      [
        `Excluir definitivamente a organização "${organization.name}"?`,
        "",
        "Esta ação apaga a organização e seus vínculos institucionais conhecidos.",
        "Usuários do Supabase Auth e registros em profiles não serão apagados automaticamente.",
        "",
        "Essa ação não pode ser desfeita.",
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/nexus-admin/organizations", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            id: organization.id,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível excluir.");
        }

        if (editingId === organization.id) {
          cancelEdit();
        }

        setSuccessMessage("Organização excluída definitivamente.");
        await loadOrganizations();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao excluir organização.";

        setErrorMessage(message);
      }
    });
  }


  if (!credentials) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-5 py-10 text-slate-900">
        <section className="w-full max-w-md rounded-3xl border border-[#dedede] bg-white p-7 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f3a4a] text-white">
              <ShieldCheck size={24} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f3a4a]">
                Nexus Admin
              </p>
              <h1 className="text-2xl font-bold text-slate-950">
                Acesso administrativo
              </h1>
            </div>
          </div>

          <p className="mb-5 text-sm leading-6 text-slate-600">
            Área exclusiva da Nexus para cadastrar órgãos e liberar o primeiro
            Owner do Publ.IA Governança.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="nexus-admin-user"
                className="text-xs font-semibold text-slate-700"
              >
                Login
              </label>

              <input
                id="nexus-admin-user"
                value={loginUser}
                onChange={(event) => setLoginUser(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none transition focus:border-[#0f3a4a]"
              />
            </div>

            <div>
              <label
                htmlFor="nexus-admin-password"
                className="text-xs font-semibold text-slate-700"
              >
                Senha
              </label>

              <div className="mt-1 flex rounded-2xl border border-[#dedede] bg-[#f8f8f8] focus-within:border-[#0f3a4a]">
                <input
                  id="nexus-admin-password"
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3 text-sm outline-none"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="px-4 text-slate-500"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f3a4a] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ShieldCheck size={18} />
              )}
              Entrar
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f5] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-[#dedede] bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f3a4a] text-white">
              <Building2 size={22} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f3a4a]">
                Nexus Admin
              </p>
              <h1 className="text-xl font-bold text-slate-950">
                Gestão de Organizações
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-7 xl:grid-cols-[420px_1fr]">
        <section className="rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
          <div className="mb-5">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
              <Plus size={14} />
              Nova organização
            </div>

            <h2 className="text-lg font-bold text-slate-950">
              Cadastrar prefeitura/órgão
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              Este cadastro cria a organização, cria o primeiro usuário no Auth,
              cria o profile e vincula como Owner em organization_members.
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Nome
              </label>
              <input
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Prefeitura Municipal de..."
                className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Nome jurídico
              </label>
              <input
                value={createForm.legalName}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    legalName: event.target.value,
                  }))
                }
                placeholder="Razão social"
                className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  CNPJ
                </label>
                <input
                  value={createForm.cnpj}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      cnpj: formatCnpjInput(event.target.value),
                    }))
                  }
                  placeholder="00.000.000/0000-00"
                  className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Tipo
                </label>
                <select
                  value={createForm.organizationType}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      organizationType: event.target
                        .value as GovernanceOrganizationType,
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                >
                  {organizationTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">
                  Município
                </label>
                <input
                  value={createForm.municipalityName}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      municipalityName: event.target.value,
                    }))
                  }
                  placeholder="Município"
                  className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  UF
                </label>
                <input
                  value={createForm.stateUf}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      stateUf: event.target.value.toUpperCase().slice(0, 2),
                    }))
                  }
                  placeholder="SP"
                  className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Código IBGE
                </label>
                <input
                  value={createForm.ibgeCode}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      ibgeCode: onlyDigits(event.target.value).slice(0, 7),
                    }))
                  }
                  placeholder="0000000"
                  className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Porte
                </label>
                <select
                  value={createForm.municipalitySize}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      municipalitySize: event.target
                        .value as GovernanceMunicipalitySize,
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                >
                  {municipalitySizeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  População
                </label>
                <input
                  inputMode="numeric"
                  value={createForm.population}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      population: onlyDigits(event.target.value),
                    }))
                  }
                  placeholder="Ex.: 50000"
                  className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Região
                </label>
                <input
                  value={createForm.region}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      region: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Norte Pioneiro"
                  className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Status
                </label>
                <select
                  value={createForm.status}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      status: event.target.value as OrganizationStatus,
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Assentos
                </label>
                <input
                  type="number"
                  min={1}
                  value={createForm.seatsLimit}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      seatsLimit: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-[#dedede] bg-[#f8f8f8] p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-950">
                Contrato e retenção
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Contrato / Referência
                  </label>
                  <input
                    value={createForm.contractReference}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        contractReference: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Contrato 001/2026"
                    className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Início do contrato
                    </label>
                    <input
                      type="date"
                      value={createForm.contractStartsAt}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          contractStartsAt: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Fim do contrato
                    </label>
                    <input
                      type="date"
                      value={createForm.contractEndsAt}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          contractEndsAt: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Retenção do histórico
                  </label>
                  <select
                    value={createForm.historyRetentionPolicy}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        historyRetentionPolicy: event.target
                          .value as GovernanceHistoryRetentionPolicy,
                      }))
                    }
                    className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  >
                    {historyRetentionPolicyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#dedede] bg-[#f8f8f8] p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-950">
                Primeiro usuário Owner
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Nome do Owner
                  </label>
                  <input
                    value={createForm.ownerNome}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        ownerNome: event.target.value,
                      }))
                    }
                    placeholder="Nome completo"
                    className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      CPF do Owner
                    </label>
                    <input
                      value={createForm.ownerCpf}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          ownerCpf: formatCpfInput(event.target.value),
                        }))
                      }
                      placeholder="000.000.000-00"
                      className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Senha inicial
                    </label>
                    <input
                      type="password"
                      value={createForm.ownerPassword}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          ownerPassword: event.target.value,
                        }))
                      }
                      placeholder="Mínimo 6 caracteres"
                      className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Papel funcional
                  </label>
                  <select
                    value={createForm.ownerFunctionalRole}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        ownerFunctionalRole: event.target
                          .value as GovernanceFunctionalRole,
                      }))
                    }
                    className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  >
                    {functionalRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <p className="mt-2 text-xs text-slate-500">
                    A permissão técnica será sempre Owner nesta tela.
                  </p>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f3a4a] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              Cadastrar organização e Owner
            </button>
          </form>
        </section>

        <section className="min-w-0 rounded-3xl border border-[#dedede] bg-white shadow-sm">
          <div className="border-b border-[#dedede] p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Organizações cadastradas
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Lista baseada diretamente na tabela organizations. Ativar ou
                  desativar aqui controla o acesso institucional.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadOrganizations()}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-70"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                Atualizar
              </button>
            </div>
          </div>

          {editingId && (
            <form
              onSubmit={handleEdit}
              className="border-b border-[#dedede] bg-[#f8f8f8] p-5"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#0f3a4a]">
                <Edit3 size={16} />
                Editando organização
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <input
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Nome"
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <input
                  value={editForm.legalName}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      legalName: event.target.value,
                    }))
                  }
                  placeholder="Nome jurídico"
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <input
                  value={editForm.cnpj}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      cnpj: formatCnpjInput(event.target.value),
                    }))
                  }
                  placeholder="CNPJ"
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <input
                  value={editForm.municipalityName}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      municipalityName: event.target.value,
                    }))
                  }
                  placeholder="Município"
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <input
                  value={editForm.stateUf}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      stateUf: event.target.value.toUpperCase().slice(0, 2),
                    }))
                  }
                  placeholder="UF"
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <input
                  value={editForm.ibgeCode}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      ibgeCode: onlyDigits(event.target.value).slice(0, 7),
                    }))
                  }
                  placeholder="Código IBGE"
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <select
                  value={editForm.municipalitySize}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      municipalitySize: event.target
                        .value as GovernanceMunicipalitySize,
                    }))
                  }
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                >
                  {municipalitySizeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  inputMode="numeric"
                  value={editForm.population}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      population: onlyDigits(event.target.value),
                    }))
                  }
                  placeholder="População"
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <input
                  value={editForm.region}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      region: event.target.value,
                    }))
                  }
                  placeholder="Região"
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <select
                  value={editForm.organizationType}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      organizationType: event.target
                        .value as GovernanceOrganizationType,
                    }))
                  }
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                >
                  {organizationTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      status: event.target.value as OrganizationStatus,
                    }))
                  }
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  value={editForm.seatsLimit}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      seatsLimit: event.target.value,
                    }))
                  }
                  placeholder="Assentos"
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <input
                  value={editForm.contractReference}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      contractReference: event.target.value,
                    }))
                  }
                  placeholder="Contrato / Referência"
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <input
                  type="date"
                  value={editForm.contractStartsAt}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      contractStartsAt: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <input
                  type="date"
                  value={editForm.contractEndsAt}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      contractEndsAt: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                />

                <select
                  value={editForm.historyRetentionPolicy}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      historyRetentionPolicy: event.target
                        .value as GovernanceHistoryRetentionPolicy,
                    }))
                  }
                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                >
                  {historyRetentionPolicyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#0f3a4a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  Salvar edição
                </button>

                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-2xl border border-[#dedede] bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {organizations.length === 0 ? (
            <div className="p-6">
              <div className="rounded-2xl border border-dashed border-[#dedede] bg-[#f8f8f8] p-6 text-sm text-slate-600">
                Nenhuma organização cadastrada ainda.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
                <thead className="bg-[#f8f8f8] text-xs uppercase text-slate-500">
                  <tr>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      Organização
                    </th>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      CNPJ
                    </th>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      Município/UF
                    </th>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      Perfil municipal
                    </th>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      Tipo
                    </th>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      Status
                    </th>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      Assentos
                    </th>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {organizations.map((organization) => (
                    <tr
                      key={organization.id}
                      className="border-b border-[#dedede] align-top last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <strong className="block text-slate-950">
                          {organization.name}
                        </strong>
                        <span className="mt-1 block text-xs text-slate-500">
                          {organization.legal_name || "Nome jurídico não informado"}
                        </span>
                        <span className="mt-1 block text-xs text-slate-400">
                          slug: {organization.slug}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          Contrato: {organization.contract_reference || "Não informado"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {formatCnpj(organization.cnpj)}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {organization.municipality_name || "Não informado"}
                        {organization.state_uf ? `/${organization.state_uf}` : ""}
                        {organization.ibge_code && (
                          <span className="mt-1 block text-xs text-slate-500">
                            IBGE: {organization.ibge_code}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        <span className="block">
                          {getGovernanceMunicipalitySizeLabel(
                            organization.municipality_size ?? "small",
                          )}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          População: {formatPopulation(organization.population)}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          Região: {organization.region || "Não informada"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {getGovernanceOrganizationTypeLabel(
                          organization.organization_type ?? "outro",
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={[
                            "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                            getStatusBadgeClass(organization.status),
                          ].join(" ")}
                        >
                          {getOrganizationStatusLabel(organization.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {organization.seats_limit ?? "Sem limite"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(organization)}
                            className="inline-flex items-center gap-1 rounded-xl border border-[#dedede] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-[#f8f8f8]"
                          >
                            <Edit3 size={14} />
                            Editar
                          </button>

                          {organization.status === "active" ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleSetStatus(organization.id, "inactive")
                              }
                              disabled={isPending}
                              className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-70"
                            >
                              <PowerOff size={14} />
                              Desativar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleSetStatus(organization.id, "active")
                              }
                              disabled={isPending}
                              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-70"
                            >
                              <Power size={14} />
                              Ativar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteOrganization(organization)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-70"
                          >
                            <Trash2 size={14} />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
