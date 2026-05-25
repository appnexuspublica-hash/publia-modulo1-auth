// src/app/governanca/usuarios/GovernanceUserActions.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Settings2, UserCheck, UserX, X } from "lucide-react";

import {
  getGovernanceFunctionalRoleLabel,
  getGovernanceTechnicalRoleLabel,
  type GovernanceFunctionalRole,
  type GovernanceMemberStatus,
  type GovernanceTechnicalRole,
} from "@/types/governance";

type GovernanceUserActionsProps = {
  memberId: string;
  isCurrentUser: boolean;
  actorTechnicalRole: GovernanceTechnicalRole;
  initialFunctionalRole: GovernanceFunctionalRole;
  initialTechnicalRole: GovernanceTechnicalRole;
  initialStatus: GovernanceMemberStatus;
};

const functionalRoles: GovernanceFunctionalRole[] = [
  "administrador",
  "gestor",
  "controle_interno",
  "juridico",
  "contabilidade",
  "licitacoes",
  "servidor",
  "consultor",
  "outro",
];

const technicalRoles: GovernanceTechnicalRole[] = [
  "owner",
  "admin",
  "manager",
  "member",
  "viewer",
];

function canManageOwner(actorTechnicalRole: GovernanceTechnicalRole) {
  return actorTechnicalRole === "owner";
}

export default function GovernanceUserActions({
  memberId,
  isCurrentUser,
  actorTechnicalRole,
  initialFunctionalRole,
  initialTechnicalRole,
  initialStatus,
}: GovernanceUserActionsProps) {
  const router = useRouter();

  const [isEditingRoles, setIsEditingRoles] = useState(false);
  const [functionalRole, setFunctionalRole] =
    useState<GovernanceFunctionalRole>(initialFunctionalRole);
  const [technicalRole, setTechnicalRole] =
    useState<GovernanceTechnicalRole>(initialTechnicalRole);
  const [status, setStatus] = useState<GovernanceMemberStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const canChangeRoles = useMemo(() => {
    if (isCurrentUser) return false;
    if (initialTechnicalRole === "owner" && !canManageOwner(actorTechnicalRole)) {
      return false;
    }

    return actorTechnicalRole === "owner" || actorTechnicalRole === "admin";
  }, [actorTechnicalRole, initialTechnicalRole, isCurrentUser]);

  async function updateMember(payload: {
    functionalRole?: GovernanceFunctionalRole;
    technicalRole?: GovernanceTechnicalRole;
    status?: GovernanceMemberStatus;
  }) {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/governance/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId,
          ...payload,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setMessage(data?.error ?? "Não foi possível atualizar o usuário.");
        return;
      }

      if (payload.status) {
        setStatus(payload.status);
      }

      setIsEditingRoles(false);
      router.refresh();
    } catch {
      setMessage("Erro de conexão ao atualizar o usuário.");
    } finally {
      setIsLoading(false);
    }
  }

  async function removeMember() {
    const confirmed = window.confirm(
      "Remover o vínculo deste usuário com o órgão? O histórico será preservado.",
    );

    if (!confirmed) return;

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/governance/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ memberId }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setMessage(data?.error ?? "Não foi possível remover o vínculo.");
        return;
      }

      setStatus("removed");
      router.refresh();
    } catch {
      setMessage("Erro de conexão ao remover o vínculo.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isCurrentUser) {
    return (
      <p className="max-w-[260px] text-xs leading-5 text-slate-500">
        Para evitar perda de acesso, seu próprio vínculo não pode ser alterado
        por aqui.
      </p>
    );
  }

  if (!canChangeRoles) {
    return (
      <p className="max-w-[260px] text-xs leading-5 text-slate-500">
        Você não tem permissão para alterar este vínculo.
      </p>
    );
  }

  if (status === "removed") {
    return (
      <p className="max-w-[260px] text-xs font-semibold text-slate-500">
        Vínculo removido.
      </p>
    );
  }

  return (
    <div className="flex min-w-[230px] flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsEditingRoles((current) => !current)}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {isEditingRoles ? "Fechar edição" : "Editar papéis"}
        </button>

        {status === "active" ? (
          <button
            type="button"
            onClick={() => updateMember({ status: "suspended" })}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserX className="h-3.5 w-3.5" />
            Suspender
          </button>
        ) : (
          <button
            type="button"
            onClick={() => updateMember({ status: "active" })}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Reativar
          </button>
        )}

        <button
          type="button"
          onClick={removeMember}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          Remover vínculo
        </button>
      </div>

      {isEditingRoles ? (
        <div className="mt-2 rounded-2xl border border-[#dedede] bg-[#f8f8f8] p-3">
          <label className="block text-xs font-semibold text-slate-700">
            Papel funcional
          </label>
          <select
            value={functionalRole}
            onChange={(event) =>
              setFunctionalRole(event.target.value as GovernanceFunctionalRole)
            }
            className="mt-1 w-full rounded-xl border border-[#dedede] bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#0b4a55]"
          >
            {functionalRoles.map((role) => (
              <option key={role} value={role}>
                {getGovernanceFunctionalRoleLabel(role)}
              </option>
            ))}
          </select>

          <label className="mt-3 block text-xs font-semibold text-slate-700">
            Permissão técnica
          </label>
          <select
            value={technicalRole}
            onChange={(event) =>
              setTechnicalRole(event.target.value as GovernanceTechnicalRole)
            }
            className="mt-1 w-full rounded-xl border border-[#dedede] bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#0b4a55]"
          >
            {technicalRoles.map((role) => {
              const disabled = role === "owner" && actorTechnicalRole !== "owner";

              return (
                <option key={role} value={role} disabled={disabled}>
                  {getGovernanceTechnicalRoleLabel(role)}
                </option>
              );
            })}
          </select>

          <button
            type="button"
            onClick={() =>
              updateMember({
                functionalRole,
                technicalRole,
              })
            }
            disabled={isLoading}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0b4a55] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#083941] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            Salvar papéis
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="text-xs font-semibold text-red-600">{message}</p>
      ) : null}
    </div>
  );
}
