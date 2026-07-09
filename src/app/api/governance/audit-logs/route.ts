// src/app/api/governance/audit-logs/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";

type AuditLogRow = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  cpf_cnpj: string | null;
  nome: string | null;
  email: string | null;
};

type EntityLabelRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  file_name?: string | null;
  url?: string | null;
  edition_number?: number | null;
  publication_date?: string | null;
  user_id?: string | null;
};

function createWritableSupabaseRouteClient() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

function onlyUniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function getMetadataText(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!metadata) {
    return "";
  }

  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function formatCpf(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const digits = value.replace(/\D/g, "");

  if (digits.length !== 11) {
    return value;
  }

  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function formatProfileName(profile: ProfileRow | undefined) {
  if (!profile) {
    return "";
  }

  return (
    profile.nome?.trim() ||
    profile.email?.trim() ||
    formatCpf(profile.cpf_cnpj) ||
    ""
  );
}

function getBestEntityLabelFromMetadata(log: AuditLogRow) {
  const metadata = log.metadata ?? {};

  const directLabel = getMetadataText(metadata, [
    "title",
    "name",
    "nome",
    "source_name",
    "file_name",
    "document_title",
    "conversation_title",
    "gazette_title",
    "owner_nome",
    "new_owner_nome",
    "target_user_name",
  ]);

  if (directLabel) {
    return directLabel;
  }

  const editionNumber = getMetadataText(metadata, [
    "edition_number",
    "editionNumber",
    "edition",
  ]);

  if (editionNumber) {
    return `Edição ${editionNumber}`;
  }

  return "";
}

function describeEntityType(entityType: string | null | undefined) {
  const normalized = String(entityType ?? "").toLowerCase();

  if (normalized.includes("conversation")) return "Conversa do Chat Governança";
  if (normalized.includes("institutional") || normalized.includes("document")) {
    return "Documento institucional";
  }
  if (normalized.includes("official_source") || normalized.includes("source")) {
    return "Fonte oficial";
  }
  if (normalized.includes("gazette")) return "Edição do Diário Oficial";
  if (normalized.includes("member") || normalized.includes("user")) return "Usuário do órgão";
  if (normalized.includes("organization")) return "Órgão";

  return "Registro";
}

async function safeSelectByIds<T extends EntityLabelRow>(params: {
  supabase: ReturnType<typeof createWritableSupabaseRouteClient>;
  table: string;
  columns: string;
  ids: string[];
  organizationId: string;
}) {
  const { supabase, table, columns, ids, organizationId } = params;

  if (ids.length === 0) {
    return [] as T[];
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("organization_id", organizationId)
      .in("id", ids);

    if (error) {
      console.warn(`[governance/audit-logs] Não foi possível enriquecer ${table}:`, error);
      return [] as T[];
    }

    return (data ?? []) as unknown as T[];
  } catch (error) {
    console.warn(`[governance/audit-logs] Erro inesperado ao enriquecer ${table}:`, error);
    return [] as T[];
  }
}

export async function GET() {
  try {
    const supabase = createWritableSupabaseRouteClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      );
    }

    const context = await getCurrentGovernanceOrganization(user.id);

    if (!context) {
      return NextResponse.json(
        { error: "Usuário não vinculado a uma organização ativa." },
        { status: 403 },
      );
    }

    const allowedTechnicalRoles = ["owner", "admin", "manager"];

    if (!allowedTechnicalRoles.includes(context.membership.technical_role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode consultar a Auditoria." },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from("organization_audit_logs")
      .select(
        `
          id,
          organization_id,
          actor_user_id,
          action,
          entity_type,
          entity_id,
          metadata,
          created_at
        `,
      )
      .eq("organization_id", context.organization.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[governance] Erro ao listar auditoria:", error);

      return NextResponse.json(
        { error: "Não foi possível listar os registros de auditoria." },
        { status: 500 },
      );
    }

    const logs = ((data ?? []) as AuditLogRow[]).map((log) => ({
      ...log,
      metadata: log.metadata ?? {},
    }));

    const actorIds = onlyUniqueNonEmpty(logs.map((log) => log.actor_user_id));

    const targetUserIdsFromMetadata = onlyUniqueNonEmpty(
      logs.map((log) => getMetadataText(log.metadata, ["target_user_id", "owner_user_id", "new_owner_user_id"])),
    );

    const profileUserIds = onlyUniqueNonEmpty([...actorIds, ...targetUserIdsFromMetadata]);

    const profilesByUserId = new Map<string, ProfileRow>();

    if (profileUserIds.length > 0) {
      try {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, cpf_cnpj, nome, email")
          .in("user_id", profileUserIds);

        if (profilesError) {
          console.warn("[governance/audit-logs] Não foi possível enriquecer perfis:", profilesError);
        } else {
          for (const profile of (profiles ?? []) as ProfileRow[]) {
            profilesByUserId.set(profile.user_id, profile);
          }
        }
      } catch (profileError) {
        console.warn("[governance/audit-logs] Erro inesperado ao enriquecer perfis:", profileError);
      }
    }

    const entityIds = onlyUniqueNonEmpty(logs.map((log) => log.entity_id));

    const [
      conversations,
      institutionalDocuments,
      officialSources,
      officialGazetteDocuments,
      organizationMembers,
    ] = await Promise.all([
      safeSelectByIds({
        supabase,
        table: "governance_conversations",
        columns: "id, title",
        ids: entityIds,
        organizationId: context.organization.id,
      }),
      safeSelectByIds({
        supabase,
        table: "institutional_documents",
        columns: "id, title, file_name",
        ids: entityIds,
        organizationId: context.organization.id,
      }),
      safeSelectByIds({
        supabase,
        table: "official_sources",
        columns: "id, name, url",
        ids: entityIds,
        organizationId: context.organization.id,
      }),
      safeSelectByIds({
        supabase,
        table: "governance_official_gazette_documents",
        columns: "id, title, edition_number, publication_date",
        ids: entityIds,
        organizationId: context.organization.id,
      }),
      safeSelectByIds({
        supabase,
        table: "organization_members",
        columns: "id, user_id",
        ids: entityIds,
        organizationId: context.organization.id,
      }),
    ]);

    const labelsByEntityId = new Map<string, string>();

    for (const conversation of conversations) {
      labelsByEntityId.set(conversation.id, conversation.title || "Conversa do Chat Governança");
    }

    for (const document of institutionalDocuments) {
      labelsByEntityId.set(document.id, document.title || document.file_name || "Documento institucional");
    }

    for (const source of officialSources) {
      labelsByEntityId.set(source.id, source.name || source.url || "Fonte oficial");
    }

    for (const gazetteDocument of officialGazetteDocuments) {
      labelsByEntityId.set(
        gazetteDocument.id,
        gazetteDocument.title ||
          (gazetteDocument.edition_number
            ? `Edição ${gazetteDocument.edition_number}`
            : "Edição do Diário Oficial"),
      );
    }

    for (const member of organizationMembers) {
      const profile = member.user_id ? profilesByUserId.get(member.user_id) : undefined;
      labelsByEntityId.set(member.id, formatProfileName(profile) || "Usuário do órgão");
    }

    const enrichedLogs = logs.map((log) => {
      const actorProfile = log.actor_user_id
        ? profilesByUserId.get(log.actor_user_id)
        : undefined;

      const metadataEntityLabel = getBestEntityLabelFromMetadata(log);
      const metadataTargetUserId = getMetadataText(log.metadata, [
        "target_user_id",
        "owner_user_id",
        "new_owner_user_id",
      ]);
      const targetProfile = metadataTargetUserId
        ? profilesByUserId.get(metadataTargetUserId)
        : undefined;

      const entityLabel =
        metadataEntityLabel ||
        (log.entity_id ? labelsByEntityId.get(log.entity_id) : "") ||
        formatProfileName(targetProfile) ||
        describeEntityType(log.entity_type);

      return {
        ...log,
        actor_name: formatProfileName(actorProfile) || null,
        actor_email: actorProfile?.email ?? null,
        actor_cpf_cnpj: actorProfile?.cpf_cnpj ?? null,
        entity_label: entityLabel,
        entity_description: describeEntityType(log.entity_type),
      };
    });

    return NextResponse.json({
      logs: enrichedLogs,
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao listar auditoria:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao listar registros de auditoria." },
      { status: 500 },
    );
  }
}
