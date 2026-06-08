// src/app/logout/route.ts
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const supabase = createSupabaseServerClient();

  await supabase.auth.signOut();

  return NextResponse.json(
    {
      ok: true,
      redirectTo: "/login",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET() {
  return NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "https://nexuspublica.vercel.app"),
  );
}
