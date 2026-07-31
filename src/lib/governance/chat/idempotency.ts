import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { GovernanceMessage } from "@/types/governance";

type GovernanceIdempotencyParams = {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  userId: string;
  clientRequestId: string;
};

export type GovernanceIdempotencyCheck =
  | { status: "available" }
  | { status: "in_progress"; userMessage: GovernanceMessage }
  | {
      status: "stale";
      userMessage: GovernanceMessage;
      leaseAgeSeconds: number;
    }
  | {
      status: "completed";
      userMessage: GovernanceMessage;
      assistantMessage: GovernanceMessage;
    }
  | { status: "unavailable"; reason: string };

const DEFAULT_IDEMPOTENCY_LEASE_SECONDS = 300;
const MIN_IDEMPOTENCY_LEASE_SECONDS = 30;
const MAX_IDEMPOTENCY_LEASE_SECONDS = 1800;

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function resolveGovernanceIdempotencyLeaseSeconds(): number {
  const configured = Number(process.env.GOVERNANCE_IDEMPOTENCY_LEASE_SECONDS);

  if (!Number.isFinite(configured)) {
    return DEFAULT_IDEMPOTENCY_LEASE_SECONDS;
  }

  return Math.max(
    MIN_IDEMPOTENCY_LEASE_SECONDS,
    Math.min(MAX_IDEMPOTENCY_LEASE_SECONDS, Math.trunc(configured)),
  );
}

function resolveProcessingStartedAt(message: GovernanceMessage): number {
  const metadata = readRecord(message.metadata);
  const metadataStartedAt = metadata.processing_started_at;
  const candidate =
    typeof metadataStartedAt === "string" && metadataStartedAt.trim().length > 0
      ? metadataStartedAt
      : message.created_at;
  const parsed = Date.parse(candidate);

  return Number.isFinite(parsed) ? parsed : Date.now();
}

function resolveLeaseAgeSeconds(message: GovernanceMessage): number {
  return Math.max(
    0,
    Math.floor((Date.now() - resolveProcessingStartedAt(message)) / 1000),
  );
}

export async function checkGovernanceClientRequestId(
  params: GovernanceIdempotencyParams,
): Promise<GovernanceIdempotencyCheck> {
  const {
    supabase,
    organizationId,
    conversationId,
    userId,
    clientRequestId,
  } = params;

  const { data, error } = await supabase
    .from("governance_messages")
    .select(
      "id, organization_id, conversation_id, user_id, role, content, metadata, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .eq("role", "user")
    .eq("metadata->>client_request_id", clientRequestId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      status: "unavailable",
      reason: error.message || "Falha ao consultar a chave idempotente.",
    };
  }

  if (data) {
    const userMessage = data as GovernanceMessage;

    const { data: assistantData, error: assistantError } = await supabase
      .from("governance_messages")
      .select(
        "id, organization_id, conversation_id, user_id, role, content, metadata, created_at",
      )
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .eq("role", "assistant")
      .eq("metadata->>client_request_id", clientRequestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assistantError) {
      return {
        status: "unavailable",
        reason:
          assistantError.message ||
          "Falha ao consultar a resposta associada à chave idempotente.",
      };
    }

    if (assistantData) {
      return {
        status: "completed",
        userMessage,
        assistantMessage: assistantData as GovernanceMessage,
      };
    }

    const leaseAgeSeconds = resolveLeaseAgeSeconds(userMessage);

    if (leaseAgeSeconds >= resolveGovernanceIdempotencyLeaseSeconds()) {
      return {
        status: "stale",
        userMessage,
        leaseAgeSeconds,
      };
    }

    return {
      status: "in_progress",
      userMessage,
    };
  }

  return { status: "available" };
}

type ReclaimGovernanceRequestParams = {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  userId: string;
  clientRequestId: string;
  userMessage: GovernanceMessage;
};

export async function reclaimStaleGovernanceRequest(
  params: ReclaimGovernanceRequestParams,
): Promise<{
  claimed: boolean;
  message: GovernanceMessage | null;
  error: unknown;
}> {
  const {
    supabase,
    organizationId,
    conversationId,
    userId,
    clientRequestId,
    userMessage,
  } = params;
  const metadata = readRecord(userMessage.metadata);
  const previousAttemptId =
    typeof metadata.processing_attempt_id === "string"
      ? metadata.processing_attempt_id
      : null;
  const previousAttemptCount = Number(metadata.processing_attempt_count ?? 1);
  const nextMetadata = {
    ...metadata,
    client_request_id: clientRequestId,
    processing_status: "processing",
    processing_started_at: new Date().toISOString(),
    processing_attempt_id: randomUUID(),
    processing_attempt_count: Number.isFinite(previousAttemptCount)
      ? Math.max(1, Math.trunc(previousAttemptCount)) + 1
      : 2,
    processing_reclaimed_at: new Date().toISOString(),
  };

  let query = supabase
    .from("governance_messages")
    .update({ metadata: nextMetadata })
    .eq("id", userMessage.id)
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .eq("role", "user")
    .eq("metadata->>client_request_id", clientRequestId);

  query = previousAttemptId
    ? query.eq("metadata->>processing_attempt_id", previousAttemptId)
    : query.is("metadata->>processing_attempt_id", null);

  const { data, error } = await query
    .select(
      "id, organization_id, conversation_id, user_id, role, content, metadata, created_at",
    )
    .maybeSingle();

  return {
    claimed: Boolean(data) && !error,
    message: data ? (data as GovernanceMessage) : null,
    error,
  };
}
