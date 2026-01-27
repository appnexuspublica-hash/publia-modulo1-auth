// src/app/api/recuperar-senha/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { onlyDigits } from "@/lib/validators";

const schema = z.object({
  cpf_cnpj: z.string().min(1),
});

function getOrigin(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const rip = req.headers.get("x-real-ip");
  if (rip) return rip.trim();
  return "unknown";
}

export async function POST(req: Request) {
  // (0) Content-Type (evita chamadas estranhas)
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Content-Type deve ser application/json." },
      { status: 415 }
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const cpf = onlyDigits(parsed.cpf_cnpj);

    // Sempre "ok" para inputs inválidos (anti enumeração)
    if (!(cpf.length === 11 || cpf.length === 14)) {
      return NextResponse.json({ ok: true });
    }

    // (1) Rate limit BEST-EFFORT no seu banco (evita estourar limite do Supabase)
    // Reaproveita a função check_rate_limit que você já arrumou:
    //  - 5 tentativas / 15 minutos por IP
    try {
      const admin = createSupabaseAdminClient();
      const ip = getClientIp(req);
      const key = `password_recovery:${ip}`;

      const { data, error } = await admin.rpc("check_rate_limit", {
        p_key: key,
        p_limit: 5,
        p_window_seconds: 15 * 60,
      });

      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row && row.allowed === false) {
          return NextResponse.json(
            { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
            { status: 429 }
          );
        }
      }
      // se der erro no RPC, segue (best-effort)
    } catch {
      // best-effort: ignora
    }

    // (2) Busca email por CPF/CNPJ (service role)
    const admin = createSupabaseAdminClient();
    const { data: prof, error: e1 } = await admin
      .from("profiles")
      .select("email")
      .eq("cpf_cnpj", cpf)
      .maybeSingle();

    if (e1) {
      console.error("[recuperar-senha] profiles lookup error:", e1);
      // anti enumeração
      return NextResponse.json({ ok: true });
    }

    const email = prof?.email?.trim()?.toLowerCase();
    if (!email) {
      // anti enumeração
      return NextResponse.json({ ok: true });
    }

    // (3) Dispara e-mail (anon key) — redirect para /atualizar-senha
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      console.error("[recuperar-senha] envs faltando", {
        hasUrl: !!supabaseUrl,
        hasAnon: !!supabaseAnon,
      });
      return NextResponse.json(
        { ok: false, error: "Servidor não configurado (Supabase envs)." },
        { status: 500 }
      );
    }

    const supa = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const origin = getOrigin(req);
    const redirectTo = `${origin}/atualizar-senha`;

    const { error: e2 } = await supa.auth.resetPasswordForEmail(email, { redirectTo });

    if (e2) {
      // Agora você ENXERGA o erro no front
      console.error("[recuperar-senha] resetPasswordForEmail error:", e2);

      const code = (e2 as any)?.code;

      // rate limit do próprio Supabase
      if (code === "over_email_send_rate_limit") {
        return NextResponse.json(
          { ok: false, error: "Limite de envio de e-mail excedido. Aguarde alguns minutos e tente novamente." },
          { status: 429 }
        );
      }

      // redirect_to não permitido (muito comum se não estiver nas Redirect URLs do Supabase)
      if (String((e2 as any)?.message || "").toLowerCase().includes("redirect")) {
        return NextResponse.json(
          { ok: false, error: "Redirect URL não permitido no Supabase. Verifique Auth → URL Configuration." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { ok: false, error: "Não foi possível enviar o e-mail agora. Tente novamente em instantes." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[recuperar-senha] unexpected error:", err);
    // anti enumeração (não revela nada)
    return NextResponse.json({ ok: true });
  }
}
