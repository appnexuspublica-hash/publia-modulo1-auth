import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) throw new Error("Supabase envs faltando");

  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST() {
  const token = crypto.randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  const supa = adminDb();
  const { error } = await supa.from("signup_tokens").insert({
    token,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[signup-token] insert error", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, token, expiresAt });
}
