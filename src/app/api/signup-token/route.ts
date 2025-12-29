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

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

async function checkRateLimit(
  supa: ReturnType<typeof adminDb>,
  key: string,
  limit: number,
  windowSeconds: number
) {
  const { data, error } = await supa.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("[rate_limit] rpc error", error);
    return { allowed: true };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: !!row?.allowed };
}

// 🔧 limpeza best-effort (não pode quebrar o fluxo)
async function cleanupBestEffort(supa: ReturnType<typeof adminDb>) {
  // roda em ~10% das vezes, para não ficar chamando sempre
  if (Math.random() > 0.1) return;

  try {
    await supa.rpc("cleanup_signup_tokens", {
      p_expired_older_minutes: 60,  // expirados há 1h+
      p_used_older_minutes: 24 * 60, // usados há 24h+
      p_batch: 200,
    });
  } catch {
    // ignora (best-effort)
  }
}

export async function POST(req: Request) {
  const supa = adminDb();

  // limpeza best-effort
  await cleanupBestEffort(supa);

  // Rate limit: 20 tokens por hora por IP
  const ip = getClientIp(req);
  const key = `signup_token:${ip}`;
  const rl = await checkRateLimit(supa, key, 20, 60 * 60);

  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Tente novamente mais tarde." },
      { status: 429 }
    );
  }

  const token = crypto.randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

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
