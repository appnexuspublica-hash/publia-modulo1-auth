// src/app/api/export-xlsx/route.ts
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

type Body = {
  filename?: string;
  rows: string[][];
};

function sanitizeFilename(name: string) {
  const base = (name || "planilha.xlsx").replace(/[^\w.-]+/g, "_");
  return base.toLowerCase().endsWith(".xlsx") ? base : `${base}.xlsx`;
}

export async function POST(req: Request) {
  try {
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

    const buffer = await workbook.xlsx.writeBuffer(); // Buffer (Node)
    const filename = sanitizeFilename(body.filename || "planilha.xlsx");

    // ✅ Converte Buffer -> Uint8Array (BodyInit compatível)
    const out =
      buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as any);

    return new Response(out, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/export-xlsx] erro:", err);
    return NextResponse.json({ error: "Erro ao gerar Excel." }, { status: 500 });
  }
}
