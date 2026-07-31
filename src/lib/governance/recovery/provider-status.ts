import type {
  GovernanceRecoveryEvidence,
  GovernanceRecoveryProvider,
  GovernanceRecoveryProviderDiagnostic,
  GovernanceRecoveryProviderStatus,
} from "./types";

type ProviderErrorClassification = {
  status: Exclude<GovernanceRecoveryProviderStatus, "success" | "empty">;
  errorCode: string;
  errorMessage: string;
};

export type GovernanceRecoveryProviderExecution = {
  provider: GovernanceRecoveryProvider;
  evidence: GovernanceRecoveryEvidence[];
  diagnostic: GovernanceRecoveryProviderDiagnostic;
};

function readErrorField(error: unknown, field: string): unknown {
  if (!error || typeof error !== "object") return undefined;
  return (error as Record<string, unknown>)[field];
}

function normalizeErrorText(error: unknown): string {
  const parts = [
    error instanceof Error ? error.name : readErrorField(error, "name"),
    error instanceof Error ? error.message : readErrorField(error, "message"),
    readErrorField(error, "code"),
    readErrorField(error, "status"),
    readErrorField(error, "statusCode"),
    readErrorField(error, "details"),
  ]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => String(value));

  return parts.join(" ").toLowerCase();
}

function readHttpStatus(error: unknown): number | null {
  for (const field of ["status", "statusCode"]) {
    const value = readErrorField(error, field);
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isInteger(parsed) && parsed >= 100 && parsed <= 599) {
      return parsed;
    }
  }

  return null;
}

export function classifyGovernanceRecoveryProviderError(
  error: unknown,
): ProviderErrorClassification {
  const text = normalizeErrorText(error);
  const httpStatus = readHttpStatus(error);

  if (
    (error instanceof Error && error.name === "AbortError") ||
    httpStatus === 408 ||
    httpStatus === 504 ||
    /\b(aborterror|timeout|timed out|etimedout|deadline exceeded)\b/.test(
      text,
    )
  ) {
    return {
      status: "timeout",
      errorCode: "PROVIDER_TIMEOUT",
      errorMessage: "A fonte excedeu o tempo limite de recuperação.",
    };
  }

  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    /\b(unauthorized|forbidden|permission denied|row level security|rls|jwt expired|invalid jwt|pgrst301)\b/.test(
      text,
    )
  ) {
    return {
      status: "unauthorized",
      errorCode: "PROVIDER_UNAUTHORIZED",
      errorMessage: "A fonte recusou a operação por falta de autorização.",
    };
  }

  if (
    error instanceof SyntaxError ||
    /\b(invalid response|invalid json|parse error|schema|validation|malformed)\b/.test(
      text,
    )
  ) {
    return {
      status: "invalid_response",
      errorCode: "PROVIDER_INVALID_RESPONSE",
      errorMessage: "A fonte retornou uma resposta inválida.",
    };
  }

  if (
    httpStatus === 429 ||
    (httpStatus !== null && httpStatus >= 500) ||
    /\b(fetch failed|network|econnreset|econnrefused|enotfound|eai_again|socket hang up|service unavailable|temporarily unavailable|upstream)\b/.test(
      text,
    )
  ) {
    return {
      status: "unavailable",
      errorCode: "PROVIDER_UNAVAILABLE",
      errorMessage: "A fonte estava temporariamente indisponível.",
    };
  }

  return {
    status: "error",
    errorCode: "PROVIDER_ERROR",
    errorMessage: "A fonte apresentou uma falha inesperada durante a recuperação.",
  };
}

function compactServerError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 500);
}

export async function executeGovernanceRecoveryProvider(params: {
  provider: GovernanceRecoveryProvider;
  operation: () => Promise<GovernanceRecoveryEvidence[]>;
}): Promise<GovernanceRecoveryProviderExecution> {
  const startedAt = Date.now();

  try {
    const evidence = await params.operation();
    const status: GovernanceRecoveryProviderStatus =
      evidence.length > 0 ? "success" : "empty";

    return {
      provider: params.provider,
      evidence,
      diagnostic: {
        provider: params.provider,
        status,
        returnedCandidates: evidence.length,
        durationMs: Math.max(0, Date.now() - startedAt),
        errorCode: null,
        errorMessage: null,
      },
    };
  } catch (error) {
    const classification = classifyGovernanceRecoveryProviderError(error);

    console.warn("[governance/recovery] Provider indisponível:", {
      provider: params.provider,
      status: classification.status,
      errorCode: classification.errorCode,
      detail: compactServerError(error),
    });

    return {
      provider: params.provider,
      evidence: [],
      diagnostic: {
        provider: params.provider,
        status: classification.status,
        returnedCandidates: 0,
        durationMs: Math.max(0, Date.now() - startedAt),
        errorCode: classification.errorCode,
        errorMessage: classification.errorMessage,
      },
    };
  }
}
