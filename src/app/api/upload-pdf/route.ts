// src/app/api/upload-pdf/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[/api/upload-pdf] Variáveis do Supabase ausentes ou inválidas.", {
    hasUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
  });
} else {
  supabase = createClient(supabaseUrl, serviceRoleKey);
}

type RegisterPdfBody = {
  conversationId: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
};

type PdfDbRow = {
  id: string;
  file_name: string;
  file_size: number;
};

export async function POST(req: Request) {
  try {
    if (!supabase) {
      return NextResponse.json(
        {
          error:
            "Configuração do servidor incompleta. Verifique variáveis do Supabase (URL e SERVICE_ROLE).",
        },
        { status: 500 }
      );
    }

    const body = (await req.json()) as Partial<RegisterPdfBody>;
    const { conversationId, fileName, fileSize, storagePath } = body;

    if (!conversationId || !fileName || !fileSize || !storagePath) {
      return NextResponse.json(
        { error: "Dados inválidos para registrar o PDF." },
        { status: 400 }
      );
    }

    const { data, error } = await (supabase as any)
      .from("pdf_files")
      .insert({
        conversation_id: conversationId,
        file_name: fileName,
        file_size: fileSize,
        storage_path: storagePath,
        openai_file_id: null,
      } as any)
      .select("id, file_name, file_size")
      .single(); // sem tipo genérico aqui

    if (error || !data) {
      console.error(
        "[/api/upload-pdf] Erro ao inserir registro em pdf_files:",
        error
      );
      return NextResponse.json(
        { error: "Não foi possível registrar o PDF no banco." },
        { status: 500 }
      );
    }

    const row = data as PdfDbRow;

    return NextResponse.json({
      id: row.id,
      fileName: row.file_name,
      fileSize: row.file_size,
    });
  } catch (err) {
    console.error("[/api/upload-pdf] Erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao registrar o PDF." },
      { status: 500 }
    );
  }
}
