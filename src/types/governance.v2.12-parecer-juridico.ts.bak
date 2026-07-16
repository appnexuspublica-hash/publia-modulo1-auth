// src/types/governance.ts

export type GovernanceProductTier = "governance";

export type OrganizationStatus =
  | "implementation"
  | "active"
  | "inactive"
  | "suspended"
  | "archived";

export type GovernanceOrganizationType =
  | "prefeitura"
  | "camara_municipal"
  | "autarquia"
  | "fundacao"
  | "consorcio_publico"
  | "instituto_previdencia"
  | "outro";

export type GovernanceMunicipalitySize = "small" | "medium" | "large";

export type GovernanceHistoryRetentionPolicy = "contract_duration";

export type GovernanceFunctionalRole =
  | "administrador"
  | "gestor"
  | "controle_interno"
  | "juridico"
  | "contabilidade"
  | "licitacoes"
  | "servidor"
  | "consultor"
  | "outro";

export type GovernanceTechnicalRole =
  | "owner"
  | "admin"
  | "manager"
  | "member"
  | "viewer";

export type GovernanceMemberStatus =
  | "active"
  | "invited"
  | "suspended"
  | "removed";

export type GovernanceConversationVisibility = "private" | "organization";

export type GovernanceConversationStatus = "active" | "archived" | "deleted";

export type GovernanceResponseMode =
  | "objective"
  | "summary"
  | "checklist"
  | "technical_opinion"
  | "risk_analysis"
  | "attention_points"
  | "action_plan"
  | "draft"
  | "comparison"
  | "manager_guidance";

export type GovernanceMessageRole = "user" | "assistant" | "system";

export type GovernanceOrganization = {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string;
  slug: string;
  organization_type: GovernanceOrganizationType;
  municipality_name: string | null;
  state_uf: string | null;
  ibge_code: string | null;
  municipality_size: GovernanceMunicipalitySize;
  population: number | null;
  region: string | null;
  product_tier: GovernanceProductTier;
  status: OrganizationStatus;
  primary_color: string;
  logo_url: string | null;
  contract_reference: string | null;
  contract_starts_at: string | null;
  contract_ends_at: string | null;
  seats_limit: number | null;
  history_retention_policy: GovernanceHistoryRetentionPolicy;
};

export type GovernanceMembership = {
  id: string;
  organization_id: string;
  user_id: string;
  functional_role: GovernanceFunctionalRole;
  technical_role: GovernanceTechnicalRole;
  status: GovernanceMemberStatus;
};

export type GovernanceContext = {
  organization: GovernanceOrganization;
  membership: GovernanceMembership;
};

export type GovernanceConversation = {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  category: string | null;
  response_mode: GovernanceResponseMode;
  visibility: GovernanceConversationVisibility;
  status: GovernanceConversationStatus;
  is_pinned: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type GovernanceMessage = {
  id: string;
  organization_id: string;
  conversation_id: string;
  user_id: string | null;
  role: GovernanceMessageRole;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type GovernanceIndicators = {
  organization: {
    id: string;
    name: string;
    seats_limit: number | null;
  };
  users: {
    total: number;
    active: number;
    suspended: number;
    seats_limit: number | null;
    seats_used: number;
  };
  chat: {
    conversations_total: number;
    conversations_active: number;
    messages_total: number;
  };
  institutional_documents: {
    total: number;
    indexed: number;
    pending_indexing: number;
  };
  official_sources: {
    total: number;
    active: number;
  };
  audit: {
    events_total: number;
    events_last_30_days: number;
  };
};

export function getGovernanceFunctionalRoleLabel(
  role: GovernanceFunctionalRole,
): string {
  const labels: Record<GovernanceFunctionalRole, string> = {
    administrador: "Administrador",
    gestor: "Gestor",
    controle_interno: "Controle Interno",
    juridico: "Jurídico",
    contabilidade: "Contabilidade",
    licitacoes: "Licitações",
    servidor: "Servidor",
    consultor: "Consultor",
    outro: "Outro",
  };

  return labels[role] ?? "Servidor";
}

export function getGovernanceTechnicalRoleLabel(
  role: GovernanceTechnicalRole,
): string {
  const labels: Record<GovernanceTechnicalRole, string> = {
    owner: "Proprietário",
    admin: "Administrador técnico",
    manager: "Gestor técnico",
    member: "Membro",
    viewer: "Leitor",
  };

  return labels[role] ?? "Membro";
}

export function getGovernanceMemberStatusLabel(
  status: GovernanceMemberStatus,
): string {
  const labels: Record<GovernanceMemberStatus, string> = {
    active: "Ativo",
    invited: "Convidado",
    suspended: "Suspenso",
    removed: "Removido",
  };

  return labels[status] ?? "Não informado";
}

export function getOrganizationStatusLabel(status: OrganizationStatus): string {
  const labels: Record<OrganizationStatus, string> = {
    implementation: "Em implantação",
    active: "Ativo",
    inactive: "Inativo",
    suspended: "Suspenso",
    archived: "Arquivado",
  };

  return labels[status] ?? "Em implantação";
}

export function getGovernanceOrganizationTypeLabel(
  type: GovernanceOrganizationType,
): string {
  const labels: Record<GovernanceOrganizationType, string> = {
    prefeitura: "Prefeitura",
    camara_municipal: "Câmara Municipal",
    autarquia: "Autarquia",
    fundacao: "Fundação",
    consorcio_publico: "Consórcio Público",
    instituto_previdencia: "Instituto/Previdência",
    outro: "Outro",
  };

  return labels[type] ?? "Órgão";
}

export function getGovernanceMunicipalitySizeLabel(
  size: GovernanceMunicipalitySize,
): string {
  const labels: Record<GovernanceMunicipalitySize, string> = {
    small: "Pequeno — até 50 mil habitantes",
    medium: "Médio — de 50 mil até 200 mil habitantes",
    large: "Grande — acima de 200 mil habitantes",
  };

  return labels[size] ?? "Não informado";
}

export function getGovernanceHistoryRetentionPolicyLabel(
  policy: GovernanceHistoryRetentionPolicy,
): string {
  const labels: Record<GovernanceHistoryRetentionPolicy, string> = {
    contract_duration: "Enquanto durar o contrato",
  };

  return labels[policy] ?? "Enquanto durar o contrato";
}

export function getGovernanceResponseModeLabel(
  mode: GovernanceResponseMode,
): string {
  const labels: Record<GovernanceResponseMode, string> = {
    objective: "Objetivo",
    summary: "Resumo",
    checklist: "Checklist",
    technical_opinion: "Parecer técnico",
    risk_analysis: "Análise de risco",
    attention_points: "Pontos de atenção",
    action_plan: "Plano de ação",
    draft: "Minuta",
    comparison: "Comparativo",
    manager_guidance: "Orientação ao gestor",
  };

  return labels[mode] ?? "Objetivo";
}

export function getGovernanceVisibilityLabel(
  visibility: GovernanceConversationVisibility,
): string {
  const labels: Record<GovernanceConversationVisibility, string> = {
    private: "Privada",
    organization: "Organização",
  };

  return labels[visibility] ?? "Privada";
}

/* ==========================================================
   AUDITORIA
========================================================== */

export type GovernanceAuditLog = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_cpf_cnpj?: string | null;
  entity_label?: string | null;
  entity_description?: string | null;
};

/* ==========================================================
   BASE INSTITUCIONAL
========================================================== */

export type GovernanceInstitutionalDocumentType =
  | "lei"
  | "decreto"
  | "portaria"
  | "parecer"
  | "regulamento"
  | "norma_interna"
  | "manual"
  | "outro";

export type GovernanceInstitutionalDocumentReviewStatus =
  | "pending"
  | "approved"
  | "rejected";

export type GovernanceInstitutionalDocumentIndexingStatus =
  | "pending"
  | "processing"
  | "indexed"
  | "error";

export type GovernanceInstitutionalDocument = {
  id: string;
  organization_id: string;
  official_source_id: string | null;
  uploaded_by: string | null;
  reviewed_by: string | null;
  title: string;
  document_type: GovernanceInstitutionalDocumentType;
  category: string | null;
  source_name: string | null;
  source_url: string | null;
  valid_from: string | null;
  valid_until: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  extracted_text: string | null;
  indexing_status: GovernanceInstitutionalDocumentIndexingStatus;
  review_status: GovernanceInstitutionalDocumentReviewStatus;
  metadata: Record<string, unknown> | null;
  reviewed_at: string | null;
  indexed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function getGovernanceInstitutionalDocumentTypeLabel(
  type: GovernanceInstitutionalDocumentType,
): string {
  const labels: Record<GovernanceInstitutionalDocumentType, string> = {
    lei: "Lei",
    decreto: "Decreto",
    portaria: "Portaria",
    parecer: "Parecer",
    regulamento: "Regulamento",
    norma_interna: "Norma interna",
    manual: "Manual",
    outro: "Outro",
  };

  return labels[type] ?? "Documento";
}

export function getGovernanceInstitutionalDocumentReviewStatusLabel(
  status: GovernanceInstitutionalDocumentReviewStatus,
): string {
  const labels: Record<GovernanceInstitutionalDocumentReviewStatus, string> = {
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Rejeitado",
  };

  return labels[status] ?? "Pendente";
}

export function getGovernanceInstitutionalDocumentIndexingStatusLabel(
  status: GovernanceInstitutionalDocumentIndexingStatus,
): string {
  const labels: Record<GovernanceInstitutionalDocumentIndexingStatus, string> = {
    pending: "Pendente",
    processing: "Processando",
    indexed: "Indexado",
    error: "Erro",
  };

  return labels[status] ?? "Pendente";
}

/* ==========================================================
   FONTES OFICIAIS
========================================================== */

export type GovernanceOfficialSourceType =
  | "municipal_website"
  | "official_gazette"
  | "transparency_portal"
  | "institutional_repository"
  | "other";

export type GovernanceOfficialSourceStatus =
  | "active"
  | "inactive";

export type GovernanceOfficialSource = {
  id: string;
  organization_id: string;
  name: string;
  source_type: GovernanceOfficialSourceType;
  url: string;
  notes: string | null;
  status: GovernanceOfficialSourceStatus;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function getGovernanceOfficialSourceTypeLabel(
  type: GovernanceOfficialSourceType,
): string {
  const labels: Record<GovernanceOfficialSourceType, string> = {
    municipal_website: "Site municipal",
    official_gazette: "Diário oficial",
    transparency_portal: "Portal da transparência",
    institutional_repository: "Repositório institucional",
    other: "Outra fonte",
  };

  return labels[type] ?? "Fonte";
}

export function getGovernanceOfficialSourceStatusLabel(
  status: GovernanceOfficialSourceStatus,
): string {
  const labels: Record<GovernanceOfficialSourceStatus, string> = {
    active: "Ativa",
    inactive: "Inativa",
  };

  return labels[status] ?? "Ativa";
}
