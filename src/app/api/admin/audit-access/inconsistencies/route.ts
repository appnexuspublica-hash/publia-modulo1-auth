// src/app/api/admin/audit-access/inconsistencies/route.ts

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  resolveUserAccess,
  type UserAccessGrantRow,
  type UserAccessRow,
} from "@/lib/access/resolveUserAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type IssueSeverity = "critical" | "warning";

type AuditIssue = {
  code:
    | "snapshot_mismatch"
    | "active_snapshot_without_active_grant"
    | "active_grant_without_snapshot"
    | "multiple_active_grants"
    | "active_trial_and_subscription"
    | "active_essential_and_strategic";
  severity: IssueSeverity;
  message: string;
  details?: Record<string, unknown>;
};

function isActiveSnapshotStatus(status: string | null | undefined): boolean {
  return (
    status === "trial_active" ||
    status === "subscription_active" ||
    status === "active"
  );
}

function isAdminLikeSnapshot(snapshot: UserAccessRow | null): boolean {
  return (
    snapshot?.product_tier === "governance" ||
    snapshot?.access_status === "blocked"
  );
}

function summarizeIssueCodes(
  inconsistencies: Array<{ issues: AuditIssue[] }>
): Record<string, number> {
  return inconsistencies.reduce<Record<string, number>>((acc, item) => {
    for (const issue of item.issues) {
      acc[issue.code] = (acc[issue.code] ?? 0) + 1;
    }

    return acc;
  }, {});
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    const [snapshotsResult, grantsResult] = await Promise.all([
      supabase.from("user_access").select("*"),
      supabase.from("user_access_grants").select("*"),
    ]);

    if (snapshotsResult.error) {
      return NextResponse.json(
        { ok: false, error: snapshotsResult.error.message },
        { status: 500 }
      );
    }

    if (grantsResult.error) {
      return NextResponse.json(
        { ok: false, error: grantsResult.error.message },
        { status: 500 }
      );
    }

    const snapshots = (snapshotsResult.data ?? []) as UserAccessRow[];
    const grants = (grantsResult.data ?? []) as UserAccessGrantRow[];

    const snapshotsByUserId = new Map<string, UserAccessRow>();
    for (const snapshot of snapshots) {
      snapshotsByUserId.set(snapshot.user_id, snapshot);
    }

    const grantsByUserId = new Map<string, UserAccessGrantRow[]>();
    for (const grant of grants) {
      const userGrants = grantsByUserId.get(grant.user_id) ?? [];
      userGrants.push(grant);
      grantsByUserId.set(grant.user_id, userGrants);
    }

    const userIds = new Set<string>([
      ...snapshotsByUserId.keys(),
      ...grantsByUserId.keys(),
    ]);

    const inconsistencies: Array<{
      user_id: string;
      issues: AuditIssue[];
      snapshot: {
        access_status: string | null;
        product_tier: string | null;
        updated_at: string | null;
      } | null;
      resolved: {
        access_status: string;
        product_tier: string | null;
        source: string;
        active_grant_id: string | null;
        active_grant_kind: string | null;
      };
      grants: {
        total: number;
        active: number;
        activeGrantIds: string[];
      };
    }> = [];

    for (const userId of userIds) {
      const snapshot = snapshotsByUserId.get(userId) ?? null;
      const userGrants = grantsByUserId.get(userId) ?? [];

      const resolved = resolveUserAccess({
        snapshot,
        grants: userGrants,
      });

      const activeGrants = resolved.grants.filter(
        (grant) => grant.isCurrentlyActive
      );

      const issues: AuditIssue[] = [];

      if (
        snapshot &&
        !isAdminLikeSnapshot(snapshot) &&
        isActiveSnapshotStatus(snapshot.access_status) &&
        activeGrants.length === 0
      ) {
        issues.push({
          code: "active_snapshot_without_active_grant",
          severity: "critical",
          message:
            "Snapshot está ativo, mas não existe grant ativo correspondente. Como grants são a fonte da verdade, o snapshot pode estar velho.",
          details: {
            snapshotAccessStatus: snapshot.access_status,
            snapshotProductTier: snapshot.product_tier,
            totalGrants: userGrants.length,
          },
        });
      }

      if (!snapshot && activeGrants.length > 0) {
        issues.push({
          code: "active_grant_without_snapshot",
          severity: "critical",
          message:
            "Existe grant ativo, mas não existe snapshot em user_access. O snapshot deve ser reconstruído.",
          details: {
            activeGrantIds: activeGrants.map((grant) => grant.id),
          },
        });
      }

      if (
        snapshot &&
        !isAdminLikeSnapshot(snapshot) &&
        (snapshot.access_status !== resolved.effectiveAccessStatus ||
          snapshot.product_tier !== resolved.effectiveProductTier)
      ) {
        issues.push({
          code: "snapshot_mismatch",
          severity: "critical",
          message: "Snapshot diverge do acesso resolvido a partir dos grants.",
          details: {
            snapshot: {
              access_status: snapshot.access_status,
              product_tier: snapshot.product_tier,
            },
            resolved: {
              access_status: resolved.effectiveAccessStatus,
              product_tier: resolved.effectiveProductTier,
              source: resolved.accessSource,
            },
          },
        });
      }

      if (activeGrants.length > 1) {
        issues.push({
          code: "multiple_active_grants",
          severity: "warning",
          message:
            "Usuário possui mais de um grant ativo. O resolver aplica prioridade, mas vale auditar para evitar conflitos futuros.",
          details: {
            activeGrantIds: activeGrants.map((grant) => grant.id),
            activeGrants: activeGrants.map((grant) => ({
              id: grant.id,
              productTier: grant.productTier,
              grantKind: grant.grantKind,
              source: grant.source,
              endsAt: grant.endsAt,
            })),
          },
        });
      }

      const hasActiveTrial = activeGrants.some(
        (grant) => grant.grantKind === "trial"
      );
      const hasActiveSubscription = activeGrants.some(
        (grant) =>
          grant.grantKind === "subscription" || grant.grantKind === "upgrade"
      );

      if (hasActiveTrial && hasActiveSubscription) {
        issues.push({
          code: "active_trial_and_subscription",
          severity: "warning",
          message:
            "Usuário possui trial ativo junto com assinatura/upgrade ativo. O plano pago deve prevalecer.",
          details: {
            activeGrantIds: activeGrants.map((grant) => grant.id),
          },
        });
      }

      const hasActiveEssential = activeGrants.some(
        (grant) => grant.productTier === "essential"
      );
      const hasActiveStrategic = activeGrants.some(
        (grant) => grant.productTier === "strategic"
      );

      if (hasActiveEssential && hasActiveStrategic) {
        issues.push({
          code: "active_essential_and_strategic",
          severity: "warning",
          message:
            "Usuário possui grants ativos de Essential e Strategic ao mesmo tempo. O Strategic deve prevalecer, mas o caso deve ser auditado.",
          details: {
            activeGrantIds: activeGrants.map((grant) => grant.id),
          },
        });
      }

      if (issues.length > 0) {
        inconsistencies.push({
          user_id: userId,
          issues,
          snapshot: snapshot
            ? {
                access_status: snapshot.access_status,
                product_tier: snapshot.product_tier,
                updated_at: snapshot.updated_at,
              }
            : null,
          resolved: {
            access_status: resolved.effectiveAccessStatus,
            product_tier: resolved.effectiveProductTier,
            source: resolved.accessSource,
            active_grant_id: resolved.activeGrant?.id ?? null,
            active_grant_kind: resolved.activeGrant?.grantKind ?? null,
          },
          grants: {
            total: userGrants.length,
            active: activeGrants.length,
            activeGrantIds: activeGrants.map((grant) => grant.id),
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      totalUsersAudited: userIds.size,
      totalSnapshots: snapshots.length,
      totalGrants: grants.length,
      inconsistenciesCount: inconsistencies.length,
      summaryByCode: summarizeIssueCodes(inconsistencies),
      inconsistencies,
    });
  } catch (error) {
    console.error("audit-access inconsistencies error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao auditar inconsistências de acesso.",
      },
      { status: 500 }
    );
  }
}
