// src/app/api/admin/audit-access/fix/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  resolveUserAccess,
  type UserAccessGrantRow,
  type UserAccessRow,
} from "@/lib/access/resolveUserAccess";
import { reconcileUserAccessSnapshot } from "@/lib/access/reconcileUserAccessSnapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FixAction =
  | "would_delete_stale_snapshot"
  | "deleted_stale_snapshot"
  | "would_reconcile_snapshot"
  | "reconciled_snapshot"
  | "skipped_no_safe_action"
  | "error";

type FixResult = {
  user_id: string;
  action: FixAction;
  reason?: string;
  snapshotAccessStatus?: string | null;
  snapshotProductTier?: string | null;
  resolvedAccessStatus?: string;
  resolvedProductTier?: string | null;
  resolvedFrom?: string;
  activeGrantIds?: string[];
  error?: string;
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

function summarizeActions(results: FixResult[]): Record<string, number> {
  return results.reduce<Record<string, number>>((acc, result) => {
    acc[result.action] = (acc[result.action] ?? 0) + 1;
    return acc;
  }, {});
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient();
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false;

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

    const results: FixResult[] = [];

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

      const baseResult = {
        user_id: userId,
        snapshotAccessStatus: snapshot?.access_status ?? null,
        snapshotProductTier: snapshot?.product_tier ?? null,
        resolvedAccessStatus: resolved.effectiveAccessStatus,
        resolvedProductTier: resolved.effectiveProductTier,
        resolvedFrom: resolved.accessSource,
        activeGrantIds: activeGrants.map((grant) => grant.id),
      };

      if (snapshot && isAdminLikeSnapshot(snapshot)) {
        results.push({
          ...baseResult,
          action: "skipped_no_safe_action",
          reason:
            "Snapshot parece ser admin/governance/blocked. Este endpoint não altera esse tipo de acesso.",
        });
        continue;
      }

      if (activeGrants.length > 1) {
        results.push({
          ...baseResult,
          action: "skipped_no_safe_action",
          reason:
            "Usuário possui múltiplos grants ativos. Este endpoint não altera grants automaticamente; exige revisão manual.",
        });
        continue;
      }

      const shouldDeleteStaleSnapshot =
        Boolean(snapshot) &&
        isActiveSnapshotStatus(snapshot?.access_status) &&
        activeGrants.length === 0 &&
        !resolved.activeGrant;

      if (shouldDeleteStaleSnapshot) {
        if (dryRun) {
          results.push({
            ...baseResult,
            action: "would_delete_stale_snapshot",
            reason:
              "Snapshot ativo sem grant ativo correspondente. Em execução real, será removido para grants voltarem a ser a fonte da verdade.",
          });
          continue;
        }

        const deleteResult = await supabase
          .from("user_access")
          .delete()
          .eq("user_id", userId);

        if (deleteResult.error) {
          results.push({
            ...baseResult,
            action: "error",
            error: deleteResult.error.message,
          });
          continue;
        }

        results.push({
          ...baseResult,
          action: "deleted_stale_snapshot",
          reason: "Snapshot velho removido com segurança.",
        });
        continue;
      }

      const shouldReconcileSnapshot =
        activeGrants.length === 1 &&
        Boolean(resolved.activeGrant) &&
        (!snapshot ||
          snapshot.access_status !== resolved.effectiveAccessStatus ||
          snapshot.product_tier !== resolved.effectiveProductTier);

      if (shouldReconcileSnapshot) {
        if (dryRun) {
          results.push({
            ...baseResult,
            action: "would_reconcile_snapshot",
            reason:
              "Existe um único grant ativo e o snapshot está ausente ou divergente. Em execução real, o snapshot será reconciliado.",
          });
          continue;
        }

        const reconcileResult = await reconcileUserAccessSnapshot({
          supabase,
          userId,
        });

        results.push({
          ...baseResult,
          action: "reconciled_snapshot",
          reason: reconcileResult.changed
            ? "Snapshot reconciliado com o grant ativo."
            : "Snapshot já estava equivalente após reconciliação.",
        });
        continue;
      }

      results.push({
        ...baseResult,
        action: "skipped_no_safe_action",
        reason:
          "Nenhuma correção automática segura foi identificada para este usuário.",
      });
    }

    const affectedResults = results.filter(
      (result) =>
        result.action !== "skipped_no_safe_action" && result.action !== "error"
    );

    return NextResponse.json({
      ok: true,
      dryRun,
      totalUsersScanned: userIds.size,
      totalSnapshots: snapshots.length,
      totalGrants: grants.length,
      affected: affectedResults.length,
      summaryByAction: summarizeActions(results),
      results,
    });
  } catch (error) {
    console.error("audit-access fix error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao corrigir inconsistências de acesso.",
      },
      { status: 500 }
    );
  }
}
