// src/app/api/upload-pdf/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// --------- Supabase (server) ----------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[/api/upload-pdf] Supabase envs ausentes ou inválidas:", {
    hasUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
  });
} else {
  supabase = createClient(supabaseUrl, serviceRoleKey);
}

// --------- Handler ----------
export async function POST(req: Request) {
  try {
    if (!supabase) {
      console.error("[/api/upload-pdf] Supabase não inicializado.");
      return NextResponse.json(
        {
          error:
            "Configuração do servidor incompleta (Supabase). Verifique as variáveis de ambiente.",
        },
        { status: 500 }
      );
    }

    const client = supabase as any;

    const formData = await req.formData();
    const file = formData.get("file");
    const conversationId = formData.get("conversationId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Arquivo PDF não enviado." },
        { status: 400 }
      );
    }

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json(
        { error: "conversationId inválido." },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // 1) Buscar user_id da conversa (para preencher pdf_files.user_id)
    // ------------------------------------------------------------------
    const { data: conv, error: convError } = await client
      .from("conversations")
      .select("user_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convError) {
      console.error(
        "[/api/upload-pdf] Erro ao buscar conversation para obter user_id:",
        convError
      );
      return NextResponse.json(
        { error: "Não foi possível localizar a conversa no banco." },
        { status: 500 }
      );
    }

    if (!conv?.user_id) {
      console.error(
        "[/api/upload-pdf] Conversation encontrada, mas sem user_id:",
        conv
      );
      return NextResponse.json(
        {
          error:
            "Conversa sem usuário associado. Não foi possível vincular o PDF.",
        },
        { status: 500 }
      );
    }

    const userId = conv.user_id as string;

    const bucket = "pdf-files";

    // Caminho único no bucket
    const originalName = (file as File).name || "documento.pdf";
    const ext =
      originalName.includes(".") ? originalName.split(".").pop() : "pdf";
    const path = `${conversationId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    // Converter File -> Buffer (Node)
    const arrayBuffer = await (file as File).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ------------------------------------------------------------------
    // 2) Upload no Storage
    // ------------------------------------------------------------------
    const { data: uploadData, error: uploadError } = await client.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: (file as File).type || "application/pdf",
        upsert: false,
      });

    if (uploadError || !uploadData) {
      console.error(
        "[/api/upload-pdf] Erro no upload para Storage:",
        uploadError
      );
      return NextResponse.json(
        {
          error:
            "Falha ao enviar arquivo para o Storage do Supabase. Verifique se o bucket 'pdf-files' existe.",
        },
        { status: 500 }
      );
    }

    // ------------------------------------------------------------------
    // 3) Registrar na tabela pdf_files
    // ------------------------------------------------------------------
    const { data: row, error: insertError } = await client
      .from("pdf_files")
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        file_name: originalName,
        storage_path: uploadData.path,
        file_size: (file as File).size,
      } as any)
      .select("id, file_name, file_size")
      .single();

    if (insertError || !row) {
      console.error(
        "[/api/upload-pdf] Erro ao inserir em pdf_files:",
        insertError
      );
      return NextResponse.json(
        {
          error:
            "PDF enviado, mas não foi possível registrar no banco (tabela pdf_files).",
        },
        { status: 500 }
      );
    }

    // ------------------------------------------------------------------
    // 4) Resposta para o front-end
    // ------------------------------------------------------------------
    return NextResponse.json({
      id: row.id,
      fileName: row.file_name,
      fileSize: row.file_size,
    });
  } catch (err) {
    console.error("[/api/upload-pdf] Erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao enviar o PDF." },
      { status: 500 }
    );
  }
}
