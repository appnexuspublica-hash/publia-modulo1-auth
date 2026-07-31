import type { GovernanceChatReference } from "@/lib/governance/chat/references";

export { GOVERNANCE_RESULT_SNAPSHOT_VERSION } from "@/lib/governance-core/version";
import { GOVERNANCE_RESULT_SNAPSHOT_VERSION } from "@/lib/governance-core/version";

export type GovernanceResultSnapshot = {
  version: string;
  legal_references: GovernanceChatReference[];
  evidence_sources: GovernanceChatReference[];
  consultation_channels: GovernanceChatReference[];
  evidence_status: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeReference(
  value: unknown,
  forcedKind: GovernanceChatReference["kind"],
): GovernanceChatReference | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = normalizeNullableString(value.title);
  if (!title) {
    return null;
  }

  const originalKind = normalizeNullableString(value.kind);
  const kind =
    forcedKind === "official" && originalKind === "institutional"
      ? "institutional"
      : forcedKind;

  const origin =
    value.origin === "knowledge" || value.origin === "web"
      ? value.origin
      : undefined;

  return {
    title,
    url: normalizeNullableString(value.url),
    kind,
    ...(origin ? { origin } : {}),
    supportText: normalizeNullableString(value.supportText),
  };
}

function normalizeReferenceList(
  value: unknown,
  forcedKind: GovernanceChatReference["kind"],
): GovernanceChatReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Map<string, GovernanceChatReference>();

  for (const item of value) {
    const reference = normalizeReference(item, forcedKind);
    if (!reference) {
      continue;
    }

    const key = [
      reference.kind,
      reference.title.toLocaleLowerCase("pt-BR"),
      reference.url ?? "",
    ].join("::");

    if (!unique.has(key)) {
      unique.set(key, reference);
    }
  }

  return Array.from(unique.values());
}

export function buildGovernanceResultSnapshot(params: {
  references: GovernanceChatReference[];
  evidenceStatus: string;
}): GovernanceResultSnapshot {
  return {
    version: GOVERNANCE_RESULT_SNAPSHOT_VERSION,
    legal_references: normalizeReferenceList(
      params.references.filter((item) => item.kind === "legal"),
      "legal",
    ),
    evidence_sources: normalizeReferenceList(
      params.references.filter(
        (item) => item.kind !== "legal" && item.kind !== "consultation",
      ),
      "official",
    ),
    consultation_channels: normalizeReferenceList(
      params.references.filter((item) => item.kind === "consultation"),
      "consultation",
    ),
    evidence_status: String(params.evidenceStatus || "unknown"),
  };
}

function hasValidGovernanceResultSnapshotShape(
  value: Record<string, unknown>,
): boolean {
  return Boolean(
    normalizeNullableString(value.version) &&
      Array.isArray(value.legal_references) &&
      Array.isArray(value.evidence_sources) &&
      Array.isArray(value.consultation_channels) &&
      normalizeNullableString(value.evidence_status),
  );
}

export function parseGovernanceResultSnapshot(
  metadata: unknown,
): GovernanceResultSnapshot | null {
  if (!isRecord(metadata) || !isRecord(metadata.governance_result)) {
    return null;
  }

  const snapshot = metadata.governance_result;

  // Um objeto parcial ou corrompido não pode bloquear a compatibilidade
  // de leitura com references/sources legados no cliente. Snapshots válidos,
  // inclusive os legitimamente vazios, sempre possuem o contrato completo.
  if (!hasValidGovernanceResultSnapshotShape(snapshot)) {
    return null;
  }

  return {
    version: normalizeNullableString(snapshot.version)!,
    legal_references: normalizeReferenceList(
      snapshot.legal_references,
      "legal",
    ),
    evidence_sources: normalizeReferenceList(
      snapshot.evidence_sources,
      "official",
    ),
    consultation_channels: normalizeReferenceList(
      snapshot.consultation_channels,
      "consultation",
    ),
    evidence_status: normalizeNullableString(snapshot.evidence_status)!,
  };
}

export function flattenGovernanceResultReferences(
  snapshot: GovernanceResultSnapshot,
): GovernanceChatReference[] {
  return [
    ...snapshot.legal_references,
    ...snapshot.evidence_sources,
    ...snapshot.consultation_channels,
  ];
}
