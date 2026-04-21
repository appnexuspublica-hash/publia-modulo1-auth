// src/app/api/admin/audit-access/inconsistencies/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveUserAccess } from "@/lib/access/resolveUserAccess";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    // pega todos snapshots
    const { data: users, error } = await supabase
      .from("user_access")
      .select("*");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const inconsistencies: any[] = [];

    for (const user of users || []) {
      const { data: grants } = await supabase
        .from("user_access_grants")
        .select("*")
        .eq("user_id", user.user_id);

      const resolved = resolveUserAccess({
        snapshot: user,
        grants: grants || [],
      });

      const isMismatch =
        user.access_status !== resolved.effectiveAccessStatus ||
        user.product_tier !== resolved.effectiveProductTier;

      if (isMismatch) {
        inconsistencies.push({
          user_id: user.user_id,
          snapshot: {
            access_status: user.access_status,
            product_tier: user.product_tier,
          },
          resolved: {
            access_status: resolved.effectiveAccessStatus,
            product_tier: resolved.effectiveProductTier,
          },
          hasActiveGrant: resolved.activeGrant !== null,
        });
      }
    }

    return NextResponse.json({
      totalUsers: users?.length || 0,
      inconsistenciesCount: inconsistencies.length,
      inconsistencies,
    });
  } catch (error: any) {
    console.error("inconsistencies error:", error);

    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
