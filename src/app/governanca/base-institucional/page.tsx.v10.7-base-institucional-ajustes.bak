import { redirect } from "next/navigation";
import { BookOpen, ShieldAlert } from "lucide-react";

import GovernanceHeader from "../components/GovernanceHeader";
import GovernanceSidebar from "../components/GovernanceSidebar";
import InstitutionalDocumentsClient from "./InstitutionalDocumentsClient";
import {
  getGovernanceFunctionalRoleLabel,
  getGovernanceTechnicalRoleLabel,
  getOrganizationStatusLabel,
  type GovernanceInstitutionalDocument,
} from "@/types/governance";
import {
  createReadonlySupabaseServerClient,
  getCurrentGovernanceOrganization,
} from "@/lib/governance/get-current-organization";

type ProfileRow = {
  cpf_cnpj: string | null;
};

function formatCpf(value: string | null | undefined) {
  if (!value) return "CPF não informado";

  const digits = value.replace(/\D/g, "");

  if (digits.length !== 11) {
    return value;
  }

  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

async function getGovernanceUserLabel(params: {
  supabase: ReturnType<typeof createReadonlySupabaseServerClient>;
  userId: string;
}) {
  const { supabase, userId } = params;

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("cpf_cnpj")
      .eq("user_id", userId)
      .maybeSingle<ProfileRow>();

    if (!error && profile?.cpf_cnpj) {
      return formatCpf(profile.cpf_cnpj);
    }
  } catch (error) {
    console.error("[governance/base-institucional] Erro ao buscar CPF:", error);
  }

  return "CPF não informado";
}

export default async function GovernanceInstitutionalBasePage() {
  const supabase = createReadonlySupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/governanca/login");
  }

  const userLabel = await getGovernanceUserLabel({
    supabase,
    userId: user.id,
  });

  const context = await getCurrentGovernanceOrganization(user.id);

  if (!context) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f5f5f5] text-slate-900">
        <GovernanceHeader
          userLabel={userLabel}
          userEmail={null}
          organizationName="Governança não configurada"
          organizationStatusLabel="Sem organização"
        />

        <main className="flex flex-1 items-center justify-center px-6">
          <section className="w-full max-w-2xl rounded-3xl border border-[#dedede] bg-white p-8 shadow-sm">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6e6e6] text-[#0f3a4a]">
              <ShieldAlert size={28} />
            </div>

            <h1 className="text-2xl font-bold text-slate-950">
              Acesso ao Governança não configurado
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Seu usuário está autenticado, mas ainda não foi vinculado a uma
              organização ativa do Publ.IA Governança.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const { organization, membership } = context;

  const canManageInstitutionalBase = ["owner", "admin", "manager"].includes(
    membership.technical_role,
  );

  const { data, error } = await supabase
    .from("institutional_documents")
    .select(
      `
        id,
        organization_id,
        official_source_id,
        uploaded_by,
        reviewed_by,
        title,
        document_type,
        category,
        source_name,
        source_url,
        valid_from,
        valid_until,
        storage_bucket,
        storage_path,
        file_name,
        file_size,
        mime_type,
        extracted_text,
        indexing_status,
        review_status,
        metadata,
        reviewed_at,
        indexed_at,
        created_at,
        updated_at
      `,
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "[governance] Erro ao listar documentos institucionais:",
      error,
    );
  }

  const documents = (data ?? []) as GovernanceInstitutionalDocument[];

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5] text-slate-900">
      <GovernanceHeader
        userLabel={userLabel}
        userEmail={null}
        organizationName={organization.name}
        organizationStatusLabel={getOrganizationStatusLabel(organization.status)}
      />

      <div className="flex min-h-0 flex-1">
        <GovernanceSidebar
          organizationName={organization.name}
          functionalRoleLabel={getGovernanceFunctionalRoleLabel(
            membership.functional_role,
          )}
          technicalRoleLabel={getGovernanceTechnicalRoleLabel(
            membership.technical_role,
          )}
        />

        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
          <section className="mb-7 rounded-3xl border border-[#dedede] bg-white p-7 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e6e6e6] px-3 py-1 text-xs font-semibold text-[#0f3a4a]">
                  <BookOpen size={14} />
                  Base institucional
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                  Documentos institucionais
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Envie e organize leis, decretos, portarias, pareceres,
                  regulamentos, normas internas e manuais do órgão. Todos os
                  registros ficam isolados pelo organization_id da organização
                  atual.
                </p>
              </div>

              <div className="rounded-2xl border border-[#dedede] bg-[#f8f8f8] px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-[#0f3a4a]">Organização</p>
                <p className="mt-1">{organization.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {documents.length} documento(s) cadastrado(s)
                </p>
              </div>
            </div>
          </section>

          {!canManageInstitutionalBase ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
              <strong>Acesso somente para gestão.</strong>
              <p className="mt-2 leading-6">
                Seu perfil pode acessar o Governança, mas não possui permissão
                técnica para gerenciar a Base Institucional. Solicite acesso a
                um administrador do órgão.
              </p>
            </section>
          ) : (
            <InstitutionalDocumentsClient initialDocuments={documents} />
          )}
        </main>
      </div>
    </div>
  );
}
