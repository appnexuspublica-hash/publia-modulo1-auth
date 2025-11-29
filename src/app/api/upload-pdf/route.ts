// src/app/api/upload-pdf/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ---------------------------------------------------------------------
// Supabase (service role) – para ignorar RLS na tabela pdf_files
// ---------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[/api/upload-pdf] Variáveis do Supabase faltando.", {
    hasUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
  });
} else {
  supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type PdfRow = {
  id: string;
  file_name: string | null;
  file_size: number | null;
};

// ---------------------------------------------------------------------
// POST /api/upload-pdf
//  Body JSON: { conversationId, fileName, fileSize, storagePath }
// ---------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    if (!supabase) {
      console.error("[/api/upload-pdf] Supabase não inicializado.");
      return NextResponse.json(
        {
          error:
            "Configuração do servidor incompleta. Verifique as variáveis do Supabase.",
        },
        { status: 500 }
      );
    }

    // Lê corpo como JSON
    let body: any;
    try {
      body = await req.json();
    } catch (err) {
      console.error("[/api/upload-pdf] Erro ao fazer parse do JSON:", err);
      return NextResponse.json(
        { error: "Corpo da requisição inválido. JSON era esperado." },
        { status: 400 }
      );
    }

    const { conversationId, fileName, fileSize, storagePath } = body as {
      conversationId?: string;
      fileName?: string;
      fileSize?: number;
      storagePath?: string;
    };

    if (!conversationId || !storagePath) {
      return NextResponse.json(
        {
          error:
            "conversationId e storagePath são obrigatórios para registrar o PDF.",
        },
        { status: 400 }
      );
    }

    const client = supabase as any;

    // (Opcional) tenta buscar o user_id da conversa
    let userId: string | null = null;
    const { data: conv, error: convError } = await client
      .from("conversations")
      .select("user_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convError) {
      console.error(
        "[/api/upload-pdf] Erro ao buscar conversa para pegar user_id:",
        convError
      );
    } else if (conv?.user_id) {
      userId = conv.user_id as string;
    }

    // Insere registro em pdf_files usando service role (ignora RLS)
    const { data, error } = await client
      .from("pdf_files")
      .insert(
        {
          conversation_id: conversationId,
          user_id: userId ?? null, // se a coluna não existir, o Supabase ignora
          file_name: fileName ?? null,
          storage_path: storagePath,
          file_size: fileSize ?? null,
        } as any
      )
      .select("id, file_name, file_size")
      .single<PdfRow>();

    if (error || !data) {
      console.error("[/api/upload-pdf] Erro ao inserir em pdf_files:", error);
      return NextResponse.json(
        {
          error: "Não foi possível registrar o PDF no banco.",
          // campo extra só pra debug (vai aparecer no console do navegador)
          detail: error?.message ?? null,
        },
        { status: 500 }
      );
    }

    // Tudo certo -> devolve dados para o front
    return NextResponse.json({
      id: data.id,
      fileName: data.file_name ?? fileName ?? "",
      fileSize: data.file_size ?? fileSize ?? 0,
    });
  } catch (err) {
    console.error("[/api/upload-pdf] Erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao registrar o PDF no banco." },
      { status: 500 }
    );
  }
}
