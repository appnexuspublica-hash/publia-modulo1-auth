import assert from "node:assert/strict";

import { buildGovernanceEvidenceBundle } from "@/lib/governance/chat/evidence-bundle";
import {
  buildEmptyGovernanceKnowledgeContext,
  buildEmptyOfficialGazetteContext,
  buildSkippedGovernanceRecoveryResult,
  decideGovernancePolicy,
} from "@/lib/governance/chat/decision-policy";
import { classifyGovernanceQuestion } from "@/lib/governance/chat/question-classifier";
import { analyzeGovernanceQuery } from "@/lib/governance/knowledge-engine/analyzer";
import type { GovernanceKnowledgeContext } from "@/lib/governance/knowledge-engine/types";
import type { GovernanceRecoveryResult } from "@/lib/governance/recovery/types";

function validateDecisionPolicy() {
  const municipalQuestion = "Quais licitações foram publicadas no Diário Oficial em julho?";
  const municipalClassification = classifyGovernanceQuestion(municipalQuestion);
  const municipalAnalysis = analyzeGovernanceQuery(municipalQuestion);
  const municipalPolicy = decideGovernancePolicy(municipalClassification, municipalAnalysis);

  assert.equal(municipalAnalysis.queryNature, "municipal_records");
  assert.equal(municipalPolicy.useRecovery, true);
  assert.equal(municipalPolicy.useMunicipalKnowledge, true);
  assert.equal(municipalPolicy.useOfficialGazette, true);
  assert.equal(municipalPolicy.useWeb, false);
  assert.deepEqual(municipalPolicy.recoveryProviders, ["official_gazette", "institutional"]);

  const legalQuestion = "Quando é permitida a dispensa de licitação pela Lei 14.133/2021?";
  const legalClassification = classifyGovernanceQuestion(legalQuestion);
  const legalAnalysis = analyzeGovernanceQuery(legalQuestion);
  const legalPolicy = decideGovernancePolicy(legalClassification, legalAnalysis);

  assert.equal(legalAnalysis.queryNature, "legal_general");
  assert.equal(legalPolicy.useRecovery, true);
  assert.equal(legalPolicy.useWeb, true);
  assert.equal(legalPolicy.useMunicipalKnowledge, false);
  assert.equal(legalPolicy.useOfficialGazette, false);
  assert.deepEqual(legalPolicy.recoveryProviders, ["legal"]);

  const generalQuestion = "Como melhorar a comunicação interna da equipe?";
  const generalClassification = classifyGovernanceQuestion(generalQuestion);
  const generalAnalysis = analyzeGovernanceQuery(generalQuestion);
  const generalPolicy = decideGovernancePolicy(generalClassification, generalAnalysis);

  assert.equal(generalAnalysis.topic, "generic");
  assert.equal(generalPolicy.useRecovery, false);
  assert.equal(generalPolicy.useWeb, true);
  assert.deepEqual(generalPolicy.recoveryProviders, []);
  assert.equal(
    buildSkippedGovernanceRecoveryResult(generalQuestion).responsePolicy.mode,
    "general"
  );
}

function validateEvidenceBundle() {
  const recovery: GovernanceRecoveryResult = {
    ...buildSkippedGovernanceRecoveryResult("Quais atos foram publicados?"),
    contextText:
      "Documento recuperado pelo orquestrador: Decreto nº 10/2026, publicado em 10/07/2026.",
    evidence: [
      {
        id: "recovery-1",
        provider: "official_gazette",
        title: "Decreto nº 10/2026",
        content: "Conteúdo do decreto recuperado.",
        normalizedContent: "conteudo do decreto recuperado",
        score: 90,
        confidence: 0.95,
        sourceUrl: "https://diario.exemplo.gov.br/edicao-10",
        documentId: "doc-1",
        chunkId: "chunk-1",
        metadata: {},
      },
    ],
  };

  const knowledge: GovernanceKnowledgeContext = {
    ...buildEmptyGovernanceKnowledgeContext(),
    contextText:
      "Documento institucional complementar: a Secretaria de Administração é responsável pela execução.",
    sources: {
      institutional: [
        {
          id: "institutional-1",
          title: "Estrutura administrativa",
          url: "https://prefeitura.exemplo.gov.br/estrutura",
          type: "Documento institucional",
          provider: "institutional",
        },
      ],
      officialGazette: [],
      officialSources: [],
    },
  };

  const officialGazette = {
    ...buildEmptyOfficialGazetteContext(),
    enabled: true,
    chunksUsed: 1,
    contextText: "Ato do Diário Oficial complementar: Portaria nº 20/2026, edição 55.",
    referenceLinks: [
      {
        label: "Portaria nº 20/2026",
        url: "https://diario.exemplo.gov.br/edicao-55",
        title: "Portaria de designação",
        editionNumber: 55,
        publicationDate: "2026-07-20",
      },
    ],
  };

  const bundle = buildGovernanceEvidenceBundle({
    question: "Quais atos foram publicados?",
    queryNature: "municipal_records",
    baseSources: {
      institutional: [],
      officialGazette: [
        {
          id: "recovery-1",
          title: "Decreto nº 10/2026",
          url: "https://diario.exemplo.gov.br/edicao-10",
          type: "Diário Oficial",
        },
      ],
      officialSources: [],
    },
    unifiedRecoveryResult: recovery,
    knowledgeContextResult: knowledge,
    officialGazetteContextResult: officialGazette,
    includeMunicipalKnowledge: true,
    includeOfficialGazette: true,
  });

  assert.match(bundle.contextText, /RECUPERAÇÃO UNIFICADA/);
  assert.match(bundle.contextText, /CONHECIMENTO MUNICIPAL COMPLEMENTAR/);
  assert.match(bundle.contextText, /DIÁRIO OFICIAL MUNICIPAL/);
  assert.equal(bundle.diagnostics.includedSections.length, 3);
  assert.equal(bundle.sources.institutional.length, 1);
  assert.equal(bundle.sources.officialGazette.length, 2);
  assert.equal(bundle.references.length, 3);

  const duplicateBundle = buildGovernanceEvidenceBundle({
    question: "Quais atos foram publicados?",
    queryNature: "municipal_records",
    baseSources: bundle.sources,
    unifiedRecoveryResult: {
      ...recovery,
      contextText: "O mesmo contexto documental foi recuperado integralmente.",
    },
    knowledgeContextResult: {
      ...knowledge,
      contextText: "O mesmo contexto documental foi recuperado integralmente.",
    },
    officialGazetteContextResult: buildEmptyOfficialGazetteContext(),
    includeMunicipalKnowledge: true,
    includeOfficialGazette: false,
  });

  assert.equal(
    duplicateBundle.diagnostics.sections.find((section) => section.id === "municipal_knowledge")
      ?.omittedReason,
    "duplicate"
  );
}

validateDecisionPolicy();
validateEvidenceBundle();

console.log(
  "Validação concluída: política de decisão e integração de evidências estão consistentes."
);
