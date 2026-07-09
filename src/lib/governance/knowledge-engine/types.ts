export type GovernanceKnowledgeProvider =
  | "institutional"
  | "official_gazette"
  | "official_sources";

export type GovernanceKnowledgeSource = {
  id: string;
  title: string;
  url: string | null;
  type: string | null;
  provider: GovernanceKnowledgeProvider;
};

export type GovernanceKnowledgeRelevanceSignals = {
  topic: string;
  titleMatches: number;
  typeMatches: number;
  bodyMatches: number;
  phraseMatches: number;
  positiveTopicSignals: number;
  negativeTopicSignals: number;
  preferredProvider: boolean;
  preferredTypeMatches: number;
  hasDirectTopicEvidence: boolean;
  requiresDirectEvidence: boolean;
};

export type GovernanceKnowledgeScoreResult = {
  score: number;
  evidence: string[];
  confidence: number;
  topic: string;
  relevance: GovernanceKnowledgeRelevanceSignals;
};

export type GovernanceKnowledgeItem = {
  id: string;
  provider: GovernanceKnowledgeProvider;
  title: string;
  url: string | null;
  type: string | null;
  score: number;
  evidence: string[];
  excerpt: string;
  metadata?: Record<string, unknown> & {
    confidence?: number;
    scoring_topic?: string;
    relevance?: GovernanceKnowledgeRelevanceSignals;
  };
};

export type GovernanceKnowledgeContext = {
  contextText: string;
  items: GovernanceKnowledgeItem[];
  sources: {
    institutional: GovernanceKnowledgeSource[];
    officialGazette: GovernanceKnowledgeSource[];
    officialSources: GovernanceKnowledgeSource[];
  };
  diagnostics: {
    totalItems: number;
    selectedItems: number;
    minScore: number;
  };
};

export type BuildGovernanceKnowledgeContextParams = {
  client: any;
  organizationId: string;
  question: string;
  maxContextChars?: number;
};
