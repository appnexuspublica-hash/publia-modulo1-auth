type RateLimitRpcResult = {
  allowed?: boolean | null;
};

type RateLimitRpcClient = {
  rpc: (
    functionName: string,
    args: {
      p_key: string;
      p_limit: number;
      p_window_seconds: number;
    },
  ) => PromiseLike<{
    data: RateLimitRpcResult | RateLimitRpcResult[] | null;
    error: { message?: string | null; code?: string | null } | null;
  }>;
};

type GovernanceRateLimitScope = "user" | "organization";

type GovernanceRateLimitRule = {
  scope: GovernanceRateLimitScope;
  key: string;
  limit: number;
  windowSeconds: number;
};

export type GovernanceRateLimitDecision =
  | {
      status: "allowed";
      checks: Array<{
        scope: GovernanceRateLimitScope;
        limit: number;
        windowSeconds: number;
      }>;
    }
  | {
      status: "blocked";
      scope: GovernanceRateLimitScope;
      limit: number;
      windowSeconds: number;
      retryAfterSeconds: number;
    }
  | {
      status: "unavailable";
      scope: GovernanceRateLimitScope;
      reason: string;
    };

const DEFAULT_USER_LIMIT = 12;
const DEFAULT_ORGANIZATION_LIMIT = 60;
const DEFAULT_WINDOW_SECONDS = 60;

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRpcRow(
  data: RateLimitRpcResult | RateLimitRpcResult[] | null,
): RateLimitRpcResult | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 160);
}

export function getGovernanceRateLimitConfiguration() {
  return {
    userLimit: readPositiveInteger(
      process.env.GOVERNANCE_CHAT_RATE_LIMIT_USER,
      DEFAULT_USER_LIMIT,
    ),
    organizationLimit: readPositiveInteger(
      process.env.GOVERNANCE_CHAT_RATE_LIMIT_ORGANIZATION,
      DEFAULT_ORGANIZATION_LIMIT,
    ),
    windowSeconds: readPositiveInteger(
      process.env.GOVERNANCE_CHAT_RATE_LIMIT_WINDOW_SECONDS,
      DEFAULT_WINDOW_SECONDS,
    ),
  };
}

export async function enforceGovernanceChatRateLimit(input: {
  serviceRoleSupabase: RateLimitRpcClient;
  userId: string;
  organizationId: string;
}): Promise<GovernanceRateLimitDecision> {
  const configuration = getGovernanceRateLimitConfiguration();
  const rules: GovernanceRateLimitRule[] = [
    {
      scope: "user",
      key: `governance_chat:user:${sanitizeKeyPart(input.userId)}`,
      limit: configuration.userLimit,
      windowSeconds: configuration.windowSeconds,
    },
    {
      scope: "organization",
      key: `governance_chat:organization:${sanitizeKeyPart(input.organizationId)}`,
      limit: configuration.organizationLimit,
      windowSeconds: configuration.windowSeconds,
    },
  ];

  const checks: Array<{
    scope: GovernanceRateLimitScope;
    limit: number;
    windowSeconds: number;
  }> = [];

  for (const rule of rules) {
    const { data, error } = await input.serviceRoleSupabase.rpc("check_rate_limit", {
      p_key: rule.key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });

    if (error) {
      return {
        status: "unavailable",
        scope: rule.scope,
        reason: error.code || error.message || "rate_limit_rpc_error",
      };
    }

    const row = normalizeRpcRow(data);

    if (!row || typeof row.allowed !== "boolean") {
      return {
        status: "unavailable",
        scope: rule.scope,
        reason: "invalid_rate_limit_response",
      };
    }

    if (!row.allowed) {
      return {
        status: "blocked",
        scope: rule.scope,
        limit: rule.limit,
        windowSeconds: rule.windowSeconds,
        retryAfterSeconds: rule.windowSeconds,
      };
    }

    checks.push({
      scope: rule.scope,
      limit: rule.limit,
      windowSeconds: rule.windowSeconds,
    });
  }

  return {
    status: "allowed",
    checks,
  };
}
