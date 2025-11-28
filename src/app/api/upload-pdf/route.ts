// src/app/api/upload-pdf/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  try {
    // 1) Garantir que as envs existem (mas sem quebrar o build)
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[upload-pdf] Variáveis de ambiente do Supabase ausentes.", {
        hasUrl: !!supabaseUrl,
        hasServiceRole: !!serviceRoleKey,
      });

      return NextResponse.json(
        {
          error:
            "Configuração do servidor incompleta. Verifique as variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 2) Ler form-data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const conversationId = formData.get("conversationId") as string | null;

    if (!file || !conversationId) {
      return NextResponse.json(
        { error: "Arquivo PDF e conversationId são obrigatórios." },
        { status: 400 }
      );
    }

    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Somente arquivos PDF são permitidos." },
        { status: 400 }
      );
    }

    const fileName = file.name || "documento.pdf";
    const fileSize = file.size;
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^\w\-.]+/g, "_");
    const storagePath = `${conversationId}/${timestamp}-${safeName}`;

    // 3) Subir para o Storage (bucket pdf-files)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("pdf-files")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("[upload-pdf] Erro ao enviar para Storage:", uploadError.message);
      return NextResponse.json(
        { error: "Não foi possível salvar o PDF no storage." },
        { status: 500 }
      );
    }

    // 4) Registrar em pdf_files
    const { data: row, error: insertError } = await supabase
      .from("pdf_files")
      .insert({
        conversation_id: conversationId,
        file_name: fileName,
        storage_path: storagePath,
      })
      .select("id, file_name, storage_path, created_at")
      .single();

    if (insertError || !row) {
      console.error("[upload-pdf] Erro ao inserir em pdf_files:", insertError?.message);
      return NextResponse.json(
        { error: "Não foi possível registrar o PDF no banco." },
        { status: 500 }
      );
    }

    // 5) Resposta esperada pelo front (ChatPageClient)
    return NextResponse.json({
      id: row.id,
      fileName,
      fileSize,
    });
  } catch (err) {
    console.error("[upload-pdf] Erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao processar o upload do PDF." },
      { status: 500 }
    );
  }
}
