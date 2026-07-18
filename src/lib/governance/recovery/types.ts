export type GovernanceRecoveryProvider =
  | "official_gazette"
  | "institutional"
  | "legal"
  | "attachment"
  | "web";

export type GovernanceRecoveryEvidence = {
  id: string;
  provider: GovernanceRecoveryProvider;
  title: string;
  content: string;
  normalizedContent: string;
  score: number;
  confidence: number;
  sourceUrl: string | null;
  documentId: string | null;
  chunkId: string | null;
  metadata: Record<string, unknown>;
};

export type GovernanceRecoveryIntent = {
  topic: string;
  queryNature: string;
  normalizedQuestion: string;
  allowedProviders: GovernanceRecoveryProvider[];
  allowWeb: boolean;
};

export type GovernanceRecoveryDiagnostics = {
  queriedProviders: GovernanceRecoveryProvider[];
  returnedByProvider: Partial<Record<GovernanceRecoveryProvider, number>>;
  totalCandidates: number;
  selectedEvidence: number;
};

export type GovernanceRecoveryResponseMode =
  | "direct_document"
  | "document_summary"
  | "comparison"
  | "insufficient_evidence"
  | "legal_analysis";

export type GovernanceRecoveryResponsePolicy = {
  mode: GovernanceRecoveryResponseMode;
  municipalEvidenceSufficient: boolean;
  comparisonReady: boolean;
  externalSourcesAllowed: boolean;
  reason: string;
};

export type GovernanceRecoveryResult = {
  intent: GovernanceRecoveryIntent;
  evidence: GovernanceRecoveryEvidence[];
  contextText: string;
  diagnostics: GovernanceRecoveryDiagnostics;
  responsePolicy: GovernanceRecoveryResponsePolicy;
};

export type GovernanceRecoveryParams = {
  client: any;
  organizationId: string;
  question: string;
  allowWeb?: boolean;
  allowedProviders?: GovernanceRecoveryProvider[];
  maxEvidence?: number;
  maxContextChars?: number;
};
