//src/app/nexus-admin/organizacoes/NexusOrganizationsClient.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
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
  getGovernanceFunctionalRoleLabel,
  getGovernanceHistoryRetentionPolicyLabel,
  getGovernanceMunicipalitySizeLabel,
  getGovernanceOrganizationTypeLabel,
  getOrganizationStatusLabel,
  type GovernanceFunctionalRole,
  type GovernanceHistoryRetentionPolicy,
  type GovernanceMunicipalitySize,
  type GovernanceOrganizationType,
  type GovernanceTechnicalRole,
  type OrganizationStatus,
} from "@/types/governance";

type OrganizationOwnerRow = {
  member_id: string;
  user_id: string;
  cpf: string | null;
  nome: string | null;
  email: string | null;
  functional_role: GovernanceFunctionalRole;
  technical_role: GovernanceTechnicalRole;
  status: string;
};

type OrganizationMemberRow = {
  member_id: string;
  user_id: string;
  cpf: string | null;
  nome: string | null;
  email: string | null;
  functional_role: GovernanceFunctionalRole;
  technical_role: GovernanceTechnicalRole;
  status: string;
};

function getGovernanceTechnicalRoleLabel(role: GovernanceTechnicalRole | string | null | undefined) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "member") return "Member";

  return "Usuário";
}

function getMemberStatusLabel(status: string | null | undefined) {
  if (status === "active") return "Ativo";
  if (status === "suspended" || status === "blocked") return "Bloqueado";
  if (status === "inactive") return "Inativo";

  return "Status não informado";
}

function getMemberStatusBadgeClass(status: string | null | undefined) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "suspended" || status === "blocked") return "border-red-200 bg-red-50 text-red-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

type OrganizationRow = {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string;
  address_logradouro: string | null;
  address_bairro: string | null;
  address_cep: string | null;
  authority_name: string | null;
  authority_position: string | null;
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
  owner: OrganizationOwnerRow | null;
  active_owners_count: number;
  members?: OrganizationMemberRow[];
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
  addressLogradouro: "",
  addressBairro: "",
  addressCep: "",
  authorityName: "",
  authorityPosition: "",
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
  ownerEmail: "",
  ownerPassword: "",
  ownerFunctionalRole: "administrador" as GovernanceFunctionalRole,
};

const initialEditForm = {
  id: "",
  name: "",
  legalName: "",
  cnpj: "",
  addressLogradouro: "",
  addressBairro: "",
  addressCep: "",
  authorityName: "",
  authorityPosition: "",
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
  ownerNome: "",
  ownerCpf: "",
  ownerPassword: "",
  ownerFunctionalRole: "administrador" as GovernanceFunctionalRole,
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
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

function formatCepInput(value: string) {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 5) return digits;

  return digits.replace(/^(\d{5})(\d{1,3})$/, "$1-$2");
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

  function updateOrganizationMemberLocally(
    organizationId: string,
    memberId: string,
    patch: Partial<OrganizationMemberRow>,
  ) {
    setOrganizations((currentOrganizations) =>
      currentOrganizations.map((organization) => {
        if (organization.id !== organizationId) {
          return organization;
        }

        const nextMembers = organization.members?.map((member) =>
          member.member_id === memberId ? { ...member, ...patch } : member,
        );

        const nextOwner =
          organization.owner?.member_id === memberId
            ? { ...organization.owner, ...patch }
            : organization.owner;

        return {
          ...organization,
          owner: nextOwner ?? null,
          members: nextMembers,
        };
      }),
    );
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();

    const ownerEmail = createForm.ownerEmail.trim().toLowerCase();

    if (!isValidEmail(ownerEmail)) {
      setErrorMessage("Informe um e-mail válido para o Owner inicial.");
      return;
    }

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
              addressLogradouro: createForm.addressLogradouro,
              addressBairro: createForm.addressBairro,
              addressCep: onlyDigits(createForm.addressCep),
              authorityName: createForm.authorityName,
              authorityPosition: createForm.authorityPosition,
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
              email: ownerEmail,
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
      addressLogradouro: organization.address_logradouro ?? "",
      addressBairro: organization.address_bairro ?? "",
      addressCep: formatCepInput(organization.address_cep ?? ""),
      authorityName: organization.authority_name ?? "",
      authorityPosition: organization.authority_position ?? "",
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
      ownerNome: organization.owner?.nome ?? "",
      ownerCpf: formatCpfInput(organization.owner?.cpf ?? ""),
      ownerPassword: "",
      ownerFunctionalRole:
        organization.owner?.functional_role ?? "administrador",
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
              addressLogradouro: editForm.addressLogradouro,
              addressBairro: editForm.addressBairro,
              addressCep: onlyDigits(editForm.addressCep),
              authorityName: editForm.authorityName,
              authorityPosition: editForm.authorityPosition,
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

  function handleTransferOwner() {
    resetMessages();

    if (!editingId) {
      return;
    }

    const confirmed = window.confirm(
      [
        "Transferir o Owner desta organização?",
        "",
        "O novo usuário passará a ser Owner.",
        "O Owner anterior será rebaixado para Admin técnico.",
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/nexus-admin/organizations", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            id: editingId,
            action: "transfer-owner",
            owner: {
              nome: editForm.ownerNome,
              cpf: onlyDigits(editForm.ownerCpf),
              password: editForm.ownerPassword,
              functionalRole: editForm.ownerFunctionalRole,
            },
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível transferir o Owner.");
        }

        setSuccessMessage("Owner transferido com sucesso.");
        setEditForm((current) => ({
          ...current,
          ownerPassword: "",
        }));
        await loadOrganizations();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao transferir Owner.";

        setErrorMessage(message);
      }
    });
  }

  function handleRemoveOwner(organization: OrganizationRow) {
    resetMessages();

    if (!organization.owner) {
      setErrorMessage("Esta organização não possui Owner ativo para remover.");
      return;
    }

    const confirmed = window.confirm(
      [
        `Remover o vínculo Owner de "${organization.owner.nome || "usuário sem nome"}"?`,
        "",
        "Esta ação só será permitida se existir outro Owner ativo na organização.",
        "O usuário não será apagado do Supabase Auth nem da tabela profiles.",
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/nexus-admin/organizations", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            id: organization.id,
            action: "remove-owner",
            ownerMemberId: organization.owner?.member_id,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível remover o Owner.");
        }

        setSuccessMessage("Vínculo Owner removido.");
        await loadOrganizations();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao remover Owner.";

        setErrorMessage(message);
      }
    });
  }


  function handleEditOrganizationMember(member: OrganizationMemberRow) {
    resetMessages();

    if (!editingId) {
      return;
    }

    const nextNome = window.prompt(
      "Nome do usuário:",
      member.nome ?? "",
    );

    if (nextNome === null) {
      return;
    }

    const currentTechnicalRole = member.technical_role ?? "member";
    const nextTechnicalRole = window.prompt(
      "Perfil técnico (owner, admin ou member):",
      currentTechnicalRole,
    );

    if (nextTechnicalRole === null) {
      return;
    }

    const normalizedTechnicalRole = nextTechnicalRole
      .trim()
      .toLowerCase() as GovernanceTechnicalRole;

    if (!["owner", "admin", "member"].includes(normalizedTechnicalRole)) {
      setErrorMessage("Perfil técnico inválido. Use owner, admin ou member.");
      return;
    }

    const currentFunctionalRole = member.functional_role ?? "servidor";
    const nextFunctionalRole = window.prompt(
      "Papel funcional (administrador, gestor, controle_interno, juridico, contabilidade, licitacoes, servidor, consultor ou outro):",
      currentFunctionalRole,
    );

    if (nextFunctionalRole === null) {
      return;
    }

    const normalizedFunctionalRole = nextFunctionalRole
      .trim()
      .toLowerCase() as GovernanceFunctionalRole;

    const validFunctionalRoles = functionalRoleOptions.map((option) => option.value);

    if (!validFunctionalRoles.includes(normalizedFunctionalRole)) {
      setErrorMessage("Papel funcional inválido.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/nexus-admin/organizations", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            id: editingId,
            organizationId: editingId,
            action: "update-member",
            memberId: member.member_id,
            member_id: member.member_id,
            userId: member.user_id,
            user_id: member.user_id,
            nome: nextNome.trim(),
            name: nextNome.trim(),
            technicalRole: normalizedTechnicalRole,
            technical_role: normalizedTechnicalRole,
            functionalRole: normalizedFunctionalRole,
            functional_role: normalizedFunctionalRole,
            member: {
              nome: nextNome.trim(),
              name: nextNome.trim(),
              technicalRole: normalizedTechnicalRole,
              technical_role: normalizedTechnicalRole,
              functionalRole: normalizedFunctionalRole,
              functional_role: normalizedFunctionalRole,
            },
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível editar o usuário.");
        }

        updateOrganizationMemberLocally(editingId, member.member_id, {
          nome: nextNome.trim(),
          technical_role: normalizedTechnicalRole,
          functional_role: normalizedFunctionalRole,
        });
        setSuccessMessage("Usuário da organização atualizado.");
        await loadOrganizations();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao editar usuário.";

        setErrorMessage(message);
      }
    });
  }

  function handleResetOrganizationMemberPassword(member: OrganizationMemberRow) {
    resetMessages();

    if (!editingId) {
      return;
    }

    const nextPassword = window.prompt(
      `Nova senha para ${member.nome || member.email || "este usuário"}:`,
      "",
    );

    if (nextPassword === null) {
      return;
    }

    if (nextPassword.trim().length < 6) {
      setErrorMessage("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/nexus-admin/organizations", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            id: editingId,
            organizationId: editingId,
            action: "reset-member-password",
            memberId: member.member_id,
            member_id: member.member_id,
            userId: member.user_id,
            user_id: member.user_id,
            password: nextPassword.trim(),
            newPassword: nextPassword.trim(),
            new_password: nextPassword.trim(),
            temporaryPassword: nextPassword.trim(),
            temporary_password: nextPassword.trim(),
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível redefinir a senha.");
        }

        setSuccessMessage("Senha redefinida.");
        await loadOrganizations();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao redefinir senha.";

        setErrorMessage(message);
      }
    });
  }

  function handleSetOrganizationMemberStatus(
    member: OrganizationMemberRow,
    nextStatus: "active" | "suspended",
  ) {
    resetMessages();

    if (!editingId) {
      return;
    }

    const actionLabel =
      nextStatus === "active" ? "reativar" : "suspender/bloquear";

    const confirmed = window.confirm(
      `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} ${
        member.nome || member.email || "este usuário"
      }?`,
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/nexus-admin/organizations", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            id: editingId,
            organizationId: editingId,
            action: "set-member-status",
            memberId: member.member_id,
            member_id: member.member_id,
            userId: member.user_id,
            user_id: member.user_id,
            status: nextStatus,
            member: {
              status: nextStatus,
            },
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível alterar o status do usuário.");
        }

        updateOrganizationMemberLocally(editingId, member.member_id, {
          status: nextStatus,
        });
        setSuccessMessage(
          nextStatus === "active" ? "Usuário reativado." : "Usuário suspenso/bloqueado.",
        );
        await loadOrganizations();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao alterar status do usuário.";

        setErrorMessage(message);
      }
    });
  }

  function handleRemoveOrganizationMember(member: OrganizationMemberRow) {
    resetMessages();

    if (!editingId) {
      return;
    }

    const confirmed = window.confirm(
      [
        `Excluir o vínculo de "${member.nome || member.email || "usuário sem nome"}" com esta organização?`,
        "",
        "O usuário não será apagado do Supabase Auth nem da tabela profiles.",
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/nexus-admin/organizations", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            id: editingId,
            action: "remove-member",
            memberId: member.member_id,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível excluir o vínculo.");
        }

        setSuccessMessage("Vínculo do usuário excluído.");
        await loadOrganizations();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro inesperado ao excluir vínculo.";

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
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white">
              <Image
                src="/logos/nexus.png"
                alt="Nexus"
                width={48}
                height={48}
                priority
                className="h-12 w-12 object-contain"
              />
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

  const currentEditingOrganization =
    organizations.find((item) => item.id === editingId) ?? null;

  const currentOrganizationMembers: OrganizationMemberRow[] =
    currentEditingOrganization?.members && currentEditingOrganization.members.length > 0
      ? currentEditingOrganization.members
      : currentEditingOrganization?.owner
        ? [currentEditingOrganization.owner]
        : [];

  return (
    <main className="min-h-screen bg-[#f5f5f5] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-[#dedede] bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white">
            <Image
              src="/logos/nexus.png"
              alt="Nexus"
              width={44}
              height={44}
              priority
              className="h-11 w-11 object-contain"
            />
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
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-7 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav className="rounded-3xl border border-[#dedede] bg-white p-3 shadow-sm">
            <div className="px-3 pb-3 pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f3a4a]">
                Menu
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Administração das organizações do Publ.IA Governança.
              </p>
            </div>

            <div className="space-y-2">
              <a
                href="#cadastrar-organizacao"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#f8f8f8] hover:text-[#0f3a4a]"
              >
                <Plus size={17} />
                Cadastrar prefeitura/órgão
              </a>

              <a
                href="#organizacoes-cadastradas"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#f8f8f8] hover:text-[#0f3a4a]"
              >
                <Building2 size={17} />
                Organizações cadastradas
              </a>

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-[#0f3a4a]"
              >
                <LogOut size={17} />
                Sair
              </button>
            </div>
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
        <section id="cadastrar-organizacao" className="scroll-mt-28 rounded-3xl border border-[#dedede] bg-white p-6 shadow-sm">
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
            <div className="grid gap-3 lg:grid-cols-4">
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

            <div className="grid gap-3 lg:grid-cols-4">
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
                Autoridade
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Nome da autoridade
                  </label>
                  <input
                    value={createForm.authorityName}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        authorityName: event.target.value,
                      }))
                    }
                    placeholder="Ex.: João da Silva"
                    className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Cargo da autoridade
                  </label>
                  <input
                    value={createForm.authorityPosition}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        authorityPosition: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Prefeito"
                    className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#dedede] bg-[#f8f8f8] p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-950">
                Endereço
              </h3>

              <div className="space-y-3">
                <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Logradouro
                    </label>
                    <input
                      value={createForm.addressLogradouro}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          addressLogradouro: event.target.value,
                        }))
                      }
                      placeholder="Ex.: Praça Central, 100"
                      className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Bairro
                    </label>
                    <input
                      value={createForm.addressBairro}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          addressBairro: event.target.value,
                        }))
                      }
                      placeholder="Ex.: Centro"
                      className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      CEP
                    </label>
                    <input
                      value={createForm.addressCep}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          addressCep: formatCepInput(event.target.value),
                        }))
                      }
                      placeholder="00000-000"
                      className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[2fr_80px_1fr_1fr]">
                  <div>
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
                      className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
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
                      className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </div>

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
                      className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </div>

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
                      className="mt-1 w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#dedede] bg-[#f8f8f8] p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-950">
                Contrato e retenção
              </h3>

              <div className="grid gap-3 lg:grid-cols-4">
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
                <div className="grid gap-3 md:grid-cols-2">
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
                </div>

                <div className="grid gap-3 md:grid-cols-3">
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
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={createForm.ownerEmail}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          ownerEmail: event.target.value,
                        }))
                      }
                      placeholder="owner@orgao.gov.br"
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

                <p className="text-xs text-slate-500">
                  A permissão técnica será sempre Owner nesta tela.
                </p>
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

        <section id="organizacoes-cadastradas" className="min-w-0 scroll-mt-28 rounded-3xl border border-[#dedede] bg-white shadow-sm">
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

              <div className="flex flex-wrap items-center gap-3">
                {editingId ? (
                  <>
                    <button
                      type="submit"
                      form="organization-edit-form"
                      disabled={isPending}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#0f3a4a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
                    >
                      {isPending && (
                        <Loader2 size={16} className="animate-spin" />
                      )}
                      Atualizar
                    </button>

                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-2xl border border-[#dedede] bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                    >
                      Fechar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => loadOrganizations()}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-70"
                  >
                    {isLoading && <Loader2 size={16} className="animate-spin" />}
                    Atualizar
                  </button>
                )}
              </div>
            </div>
          </div>

          {editingId && (
            <form
              id="organization-edit-form"
              onSubmit={handleEdit}
              className="border-b border-[#dedede] bg-[#f8f8f8] p-5"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#0f3a4a]">
                <Edit3 size={16} />
                Editando organização
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Nome
                  </span>
                  <input
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Nome"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Nome jurídico
                  </span>
                  <input
                    value={editForm.legalName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        legalName: event.target.value,
                      }))
                    }
                    placeholder="Nome jurídico"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    CNPJ
                  </span>
                  <input
                    value={editForm.cnpj}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        cnpj: formatCnpjInput(event.target.value),
                      }))
                    }
                    placeholder="CNPJ"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Nome da autoridade
                  </span>
                  <input
                    value={editForm.authorityName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        authorityName: event.target.value,
                      }))
                    }
                    placeholder="Nome da autoridade"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Cargo da autoridade
                  </span>
                  <input
                    value={editForm.authorityPosition}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        authorityPosition: event.target.value,
                      }))
                    }
                    placeholder="Cargo da autoridade"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Município
                  </span>
                  <input
                    value={editForm.municipalityName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        municipalityName: event.target.value,
                      }))
                    }
                    placeholder="Município"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    UF
                  </span>
                  <input
                    value={editForm.stateUf}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        stateUf: event.target.value.toUpperCase().slice(0, 2),
                      }))
                    }
                    placeholder="UF"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Logradouro
                  </span>
                  <input
                    value={editForm.addressLogradouro}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        addressLogradouro: event.target.value,
                      }))
                    }
                    placeholder="Logradouro"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Bairro
                  </span>
                  <input
                    value={editForm.addressBairro}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        addressBairro: event.target.value,
                      }))
                    }
                    placeholder="Bairro"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    CEP
                  </span>
                  <input
                    value={editForm.addressCep}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        addressCep: formatCepInput(event.target.value),
                      }))
                    }
                    placeholder="CEP"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Código IBGE
                  </span>
                  <input
                    value={editForm.ibgeCode}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        ibgeCode: onlyDigits(event.target.value).slice(0, 7),
                      }))
                    }
                    placeholder="Código IBGE"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Porte
                  </span>
                  <select
                    value={editForm.municipalitySize}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        municipalitySize: event.target
                          .value as GovernanceMunicipalitySize,
                      }))
                    }
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  >
                    {municipalitySizeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    População
                  </span>
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
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Região
                  </span>
                  <input
                    value={editForm.region}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        region: event.target.value,
                      }))
                    }
                    placeholder="Região"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Tipo
                  </span>
                  <select
                    value={editForm.organizationType}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        organizationType: event.target
                          .value as GovernanceOrganizationType,
                      }))
                    }
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  >
                    {organizationTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Status
                  </span>
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        status: event.target.value as OrganizationStatus,
                      }))
                    }
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Assentos
                  </span>
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
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Contrato / Referência
                  </span>
                  <input
                    value={editForm.contractReference}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        contractReference: event.target.value,
                      }))
                    }
                    placeholder="Contrato / Referência"
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Início do contrato
                  </span>
                  <input
                    type="date"
                    value={editForm.contractStartsAt}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        contractStartsAt: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Fim do contrato
                  </span>
                  <input
                    type="date"
                    value={editForm.contractEndsAt}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        contractEndsAt: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Retenção do histórico
                  </span>
                  <select
                    value={editForm.historyRetentionPolicy}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        historyRetentionPolicy: event.target
                          .value as GovernanceHistoryRetentionPolicy,
                      }))
                    }
                    className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                  >
                    {historyRetentionPolicyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 rounded-3xl border border-[#dedede] bg-white p-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f3a4a]">
                    Owner da organização
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Use este bloco para visualizar, trocar ou remover o proprietário técnico da organização.
                  </p>
                </div>

                {organizations.find((item) => item.id === editingId)?.owner ? (
                  <div className="mb-4 grid gap-3 rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4 text-sm md:grid-cols-3">
                    <div>
                      <span className="block text-xs font-semibold uppercase text-slate-500">
                        Owner atual
                      </span>
                      <strong className="mt-1 block text-slate-950">
                        {organizations.find((item) => item.id === editingId)?.owner?.nome ||
                          "Nome não informado"}
                      </strong>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold uppercase text-slate-500">
                        CPF
                      </span>
                      <span className="mt-1 block text-slate-700">
                        {organizations.find((item) => item.id === editingId)?.owner?.cpf
                          ? formatCpfInput(
                              organizations.find((item) => item.id === editingId)?.owner
                                ?.cpf ?? "",
                            )
                          : "Não informado"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold uppercase text-slate-500">
                        Perfil
                      </span>
                      <span className="mt-1 block text-slate-700">
                        {getGovernanceFunctionalRoleLabel(
                          organizations.find((item) => item.id === editingId)?.owner
                            ?.functional_role ?? "administrador",
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Nenhum Owner ativo encontrado para esta organização.
                  </div>
                )}

                {organizations.find((item) => item.id === editingId) && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        const organization = organizations.find(
                          (item) => item.id === editingId,
                        );

                        if (organization) {
                          handleRemoveOwner(organization);
                        }
                      }}
                      disabled={isPending}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 disabled:opacity-70"
                    >
                      <Trash2 size={16} />
                      Remover vínculo Owner
                    </button>
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Nome do novo Owner
                    </span>
                    <input
                      value={editForm.ownerNome}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          ownerNome: event.target.value,
                        }))
                      }
                      placeholder="Nome do novo Owner"
                      className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      CPF do novo Owner
                    </span>
                    <input
                      value={editForm.ownerCpf}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          ownerCpf: formatCpfInput(event.target.value),
                        }))
                      }
                      placeholder="CPF do novo Owner"
                      className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Senha inicial
                    </span>
                    <input
                      type="password"
                      value={editForm.ownerPassword}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          ownerPassword: event.target.value,
                        }))
                      }
                      placeholder="Senha inicial se for novo usuário"
                      className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Papel funcional
                    </span>
                    <select
                      value={editForm.ownerFunctionalRole}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          ownerFunctionalRole: event.target
                            .value as GovernanceFunctionalRole,
                        }))
                      }
                      className="w-full rounded-2xl border border-[#dedede] bg-white px-4 py-3 text-sm outline-none focus:border-[#0f3a4a]"
                    >
                      {functionalRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleTransferOwner}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#0f3a4a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
                  >
                    {isPending && <Loader2 size={16} className="animate-spin" />}
                    Transferir Owner
                  </button>
                </div>
              </div>

              {currentEditingOrganization && (
                <div className="mt-5 rounded-3xl border border-[#dedede] bg-white p-4">
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f3a4a]">
                      Usuários da organização
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Lista de usuários vinculados à organização selecionada.
                    </p>
                  </div>

                  {currentOrganizationMembers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#dedede] bg-[#f8f8f8] p-4 text-sm text-slate-600">
                      Nenhum usuário vinculado encontrado para esta organização.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentOrganizationMembers.map((member) => {
                        const memberStatusLabel = getMemberStatusLabel(member.status);
                        const isBlocked =
                          member.status === "suspended" || member.status === "blocked";

                        return (
                          <div
                            key={member.member_id}
                            className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-4"
                          >
                            <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-[1.4fr_0.8fr_1fr_1.4fr_auto] lg:items-start">
                              <div>
                                <p className="text-xs font-semibold uppercase text-slate-500">
                                  Nome
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-950">
                                  {member.nome || "Usuário sem nome"}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase text-slate-500">
                                  Perfil técnico
                                </p>
                                <p className="mt-1 text-sm text-slate-700">
                                  {getGovernanceTechnicalRoleLabel(member.technical_role)}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase text-slate-500">
                                  Papel funcional
                                </p>
                                <p className="mt-1 text-sm text-slate-700">
                                  {getGovernanceFunctionalRoleLabel(member.functional_role)}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase text-slate-500">
                                  E-mail
                                </p>
                                <p className="mt-1 break-all text-sm text-slate-700">
                                  {member.email || "Não informado"}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase text-slate-500">
                                  Status
                                </p>
                                <span
                                  className={`mt-1 inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getMemberStatusBadgeClass(
                                    member.status,
                                  )}`}
                                >
                                  {memberStatusLabel}
                                </span>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditOrganizationMember(member)}
                                disabled={isPending}
                                className="rounded-2xl border border-[#dedede] bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                              >
                                Editar
                              </button>

                              {!isBlocked && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleResetOrganizationMemberPassword(member)
                                  }
                                  disabled={isPending}
                                  className="rounded-2xl border border-[#dedede] bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                                >
                                  Redefinir senha
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  handleSetOrganizationMemberStatus(
                                    member,
                                    isBlocked ? "active" : "suspended",
                                  )
                                }
                                disabled={isPending}
                                className="rounded-2xl border border-[#dedede] bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                              >
                                {isBlocked ? "Reativar" : "Suspender/bloquear"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveOrganizationMember(member)}
                                disabled={isPending}
                                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                              >
                                Excluir vínculo
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

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
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead className="bg-[#f8f8f8] text-xs uppercase text-slate-500">
                  <tr>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      Organização
                    </th>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      CNPJ
                    </th>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      Owner
                    </th>
                    <th className="border-b border-[#dedede] px-5 py-3">
                      Município/UF
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
                        {organization.owner?.nome || "Não informado"}
                        <span className="mt-1 block text-xs text-slate-500">
                          CPF: {organization.owner?.cpf
                            ? formatCpfInput(organization.owner.cpf)
                            : "Não informado"}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          Perfil: {organization.owner?.functional_role
                            ? getGovernanceFunctionalRoleLabel(
                                organization.owner.functional_role,
                              )
                            : "Não informado"}
                        </span>
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
      </div>
    </main>
  );
}
