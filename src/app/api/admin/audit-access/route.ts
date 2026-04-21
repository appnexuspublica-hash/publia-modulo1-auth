// src/app/api/admin/audit-access/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveUserAccess } from "@/lib/access/resolveUserAccess";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: snapshot } = await supabase
      .from("user_access")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: grants } = await supabase
      .from("user_access_grants")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const resolved = resolveUserAccess({
      snapshot,
      grants,
    });

    return NextResponse.json({
      userId,
      snapshot,
      grants,
      resolved,
      debug: {
        hasSnapshot: !!snapshot,
        hasGrants: (grants || []).length > 0,
        hasActiveGrant: resolved.activeGrant !== null,
        accessStatus: resolved.effectiveAccessStatus,
        productTier: resolved.effectiveProductTier,
        accessSource: resolved.accessSource,
        isBlocked: resolved.effectiveAccessStatus === "blocked",
      },
    });
  } catch (error: any) {
    console.error("audit-access error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
