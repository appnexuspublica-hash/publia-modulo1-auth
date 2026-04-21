// src/app/api/admin/audit-access/fix/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveUserAccess } from "@/lib/access/resolveUserAccess";
import { reconcileUserAccessSnapshot } from "@/lib/access/reconcileUserAccessSnapshot";

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient();
    const body = await req.json().catch(() => ({}));

    const dryRun = body?.dryRun ?? true;

    const { data: snapshots } = await supabase
      .from("user_access")
      .select("*");

    const results: any[] = [];

    for (const snapshot of snapshots || []) {
      const { data: grants } = await supabase
        .from("user_access_grants")
        .select("*")
        .eq("user_id", snapshot.user_id);

      const resolved = resolveUserAccess({
        snapshot,
        grants: grants || [],
      });

      const inconsistent =
        snapshot.access_status !== resolved.effectiveAccessStatus ||
        snapshot.product_tier !== resolved.effectiveProductTier;

      if (!inconsistent) continue;

      if (dryRun) {
        results.push({
          user_id: snapshot.user_id,
          status: "would_fix",
        });
        continue;
      }

      const reconcile = await reconcileUserAccessSnapshot({
        supabase,
        userId: snapshot.user_id,
      });

      results.push({
        user_id: snapshot.user_id,
        fixed: reconcile.changed,
      });
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      total: snapshots?.length || 0,
      affected: results.length,
      results,
    });
  } catch (error: any) {
    console.error("fix error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
