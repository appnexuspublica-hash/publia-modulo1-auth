// src/app/api/export-xlsx/route.ts
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Body = {
  filename?: string;
  rows: string[][];
};

function sanitizeFilename(name: string) {
  const base = (name || "planilha.xlsx").replace(/[^\w.-]+/g, "_");
  return base.toLowerCase().endsWith(".xlsx") ? base : `${base}.xlsx`;
}

function parseCookieHeader(cookieHeader: string | null) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;

  for (const part of cookieHeader.split(";")) {
    const p = part.trim();
    if (!p) continue;

    const eq = p.indexOf("=");
    if (eq === -1) continue;

    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    out[k] = decodeURIComponent(v);
  }

  return out;
}

function createAuthClient(req: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase envs faltando");
  }

  const jar = parseCookieHeader(req.headers.get("cookie"));

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name) => jar[name],
      set() {},
      remove() {},
    },
  });
}

async function registerExportEvent(
  client: any,
  params: {
    userId: string;
    filename: string;
    rowsCount: number;
    cellsCount: number;
  }
) {
  const { userId, filename, rowsCount, cellsCount } = params;

  const { error } = await client.from("usage_events").insert({
    user_id: userId,
    event_type: "export_xlsx",
    input_tokens: 0,
    output_tokens: 0,
    metadata: {
      filename,
      rowsCount,
      cellsCount,
    },
  });

  if (error) {
    console.error("[/api/export-xlsx] erro ao registrar usage_events", error);
  }
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Servidor não configurado (Supabase envs)." },
        { status: 500 }
      );
    }

    const client = createAuthClient(req) as any;

    const { data: auth, error: authErr } = await client.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const userId = auth.user.id;

    const body = (await req.json()) as Body;

    if (!body?.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "rows inválido" }, { status: 400 });
    }

    // limite simples pra evitar abuso
    const maxCells = 200_000;
    const cells = body.rows.reduce((acc, r) => acc + (r?.length ?? 0), 0);

    if (cells > maxCells) {
      return NextResponse.json(
        { error: "Planilha grande demais para exportação." },
        { status: 413 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Planilha");

    for (const r of body.rows) {
      ws.addRow((r ?? []).map((v) => (v ?? "").toString()));
    }

    if (body.rows.length > 0) {
      ws.getRow(1).font = { bold: true };
    }

    const filename = sanitizeFilename(body.filename || "planilha.xlsx");

    await registerExportEvent(client, {
      userId,
      filename,
      rowsCount: body.rows.length,
      cellsCount: cells,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const out = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as any);

    return new Response(out, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/export-xlsx] erro:", err);
    return NextResponse.json({ error: "Erro ao gerar Excel." }, { status: 500 });
  }
}