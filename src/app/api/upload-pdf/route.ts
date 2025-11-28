// src/app/api/upload-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// ----------------------------------------------------
// Variáveis de ambiente
// ----------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error(
    "Verifique NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local"
  );
}

// Client ADMIN (service role) -> Storage + inserts
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// ----------------------------------------------------
// Handler
// ----------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    // 1) Recuperar sessão do usuário via cookies (Supabase Auth)
    const cookieStore = cookies();

    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Em route handler poderíamos setar cookies,
        // mas para este fluxo não é necessário atualizar nada:
        set() {},
        remove() {},
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.error("[upload-pdf] Usuário não autenticado:", userError);
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 2) Ler FormData (file + conversationId)
    const formData = await req.formData();
    const file = formData.get("file");
    const conversationId = formData.get("conversationId");

    if (!file || !(file instanceof File)) {
      console.error("[upload-pdf] Nenhum arquivo válido recebido.");
      return NextResponse.json(
        { error: "Arquivo não enviado." },
        { status: 400 }
      );
    }

    if (!file.type || !file.type.toLowerCase().includes("pdf")) {
      console.error("[upload-pdf] Tipo de arquivo inválido:", file.type);
      return NextResponse.json(
        { error: "Apenas arquivos PDF são permitidos." },
        { status: 400 }
      );
    }

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json(
        { error: "conversationId é obrigatório." },
        { status: 400 }
      );
    }

    // 3) Garantir que a conversa pertence ao usuário logado
    const { data: conv, error: convError } = await supabaseAdmin
      .from("conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convError) {
      console.error("[upload-pdf] Erro ao buscar conversa:", convError.message);
      return NextResponse.json(
        { error: "Erro ao validar conversa." },
        { status: 500 }
      );
    }

    if (!conv) {
      return NextResponse.json(
        { error: "Conversa não encontrada." },
        { status: 404 }
      );
    }

    if (conv.user_id !== userId) {
      console.warn(
        "[upload-pdf] Usuário tentando anexar PDF em conversa de outro usuário.",
        { userId, conversationId }
      );
      return NextResponse.json(
        { error: "Você não tem permissão para alterar esta conversa." },
        { status: 403 }
      );
    }

    // 4) Montar caminho seguro no bucket "pdf-files"
    const safeName = file.name.replace(/\s+/g, "-");
    const pathConversation = conversationId;
    const filePath = `${pathConversation}/${Date.now()}-${safeName}`;

    // 5) Upload no Storage
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from("pdf-files")
      .upload(filePath, file, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });

    if (storageError || !storageData) {
      console.error("[upload-pdf] Erro ao salvar no Storage:", storageError);
      return NextResponse.json(
        { error: "Erro ao salvar PDF no Storage." },
        { status: 500 }
      );
    }

    // 6) Insert na tabela pdf_files (amarrado ao user_id real)
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("pdf_files")
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        storage_path: storageData.path,
        file_name: file.name,
        size: file.size,
      })
      .select("id")
      .single();

    if (insertError || !insertData) {
      console.error(
        "[upload-pdf] Erro ao salvar metadados do PDF:",
        insertError
      );
      return NextResponse.json(
        { error: "Erro ao salvar metadados do PDF." },
        { status: 500 }
      );
    }

    console.log("[upload-pdf] Upload OK:", {
      pdfFileId: insertData.id,
      storagePath: storageData.path,
      userId,
      conversationId,
    });

    // 7) Resposta no formato que o front já espera
    return NextResponse.json({
      id: insertData.id as string,
      fileName: file.name,
      fileSize: file.size,
      storagePath: storageData.path,
    });
  } catch (err) {
    console.error("[upload-pdf] Erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao enviar o PDF." },
      { status: 500 }
    );
  }
}
