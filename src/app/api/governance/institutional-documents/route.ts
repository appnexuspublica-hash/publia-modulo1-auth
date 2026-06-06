// src/app/api/governance/institutional-documents/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";

const DEFAULT_BUCKET = "governance-documents";

const allowedDocumentTypes = new Set([
  "lei",
  "decreto",
  "portaria",
  "instrucao_normativa",
  "manual",
  "parecer_modelo",
  "regulamento",
  "contrato",
  "edital",
  "ata",
  "outro",
]);

const documentTypeAliases: Record<string, string> = {
  parecer: "parecer_modelo",
  norma_interna: "instrucao_normativa",
};

function createWritableSupabaseRouteClient() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

function getTextField(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getNullableTextField(formData: FormData, key: string) {
  const value = getTextField(formData, key);
  return value.length > 0 ? value : null;
}

function normalizeDocumentType(value: string) {
  const normalizedValue = documentTypeAliases[value] ?? value;
  return allowedDocumentTypes.has(normalizedValue) ? normalizedValue : "outro";
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getMaxUploadBytes() {
  const configuredValue = Number(process.env.PDF_EXTRACT_MAX_MB ?? "120");
  const maxUploadMb =
    Number.isFinite(configuredValue) && configuredValue > 0
      ? configuredValue
      : 120;

  return maxUploadMb * 1024 * 1024;
}

export async function GET() {
  try {
    const supabase = createWritableSupabaseRouteClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      );
    }

    const context = await getCurrentGovernanceOrganization(user.id);

    if (!context) {
      return NextResponse.json(
        { error: "Usuário não vinculado a uma organização ativa." },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from("institutional_documents")
      .select(
        `
          id,
          organization_id,
          official_source_id,
          uploaded_by,
          reviewed_by,
          title,
          document_type,
          category,
          source_name,
          source_url,
          valid_from,
          valid_until,
          storage_bucket,
          storage_path,
          file_name,
          file_size,
          mime_type,
          extracted_text,
          indexing_status,
          review_status,
          metadata,
          reviewed_at,
          indexed_at,
          created_at,
          updated_at
        `,
      )
      .eq("organization_id", context.organization.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "[governance] Erro ao listar documentos institucionais:",
        error,
      );

      return NextResponse.json(
        { error: "Não foi possível listar os documentos institucionais." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      documents: data ?? [],
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao listar documentos institucionais:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao listar documentos institucionais." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createWritableSupabaseRouteClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      );
    }

    const context = await getCurrentGovernanceOrganization(user.id);

    if (!context) {
      return NextResponse.json(
        { error: "Usuário não vinculado a uma organização ativa." },
        { status: 403 },
      );
    }

    const allowedTechnicalRoles = ["owner", "admin", "manager"];

    if (!allowedTechnicalRoles.includes(context.membership.technical_role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode gerenciar a Base Institucional." },
        { status: 403 },
      );
    }

    const formData = await request.formData();

    const title = getTextField(formData, "title");
    const documentType = normalizeDocumentType(
      getTextField(formData, "documentType"),
    );
    const category = getNullableTextField(formData, "category");
    const sourceName = getNullableTextField(formData, "sourceName");
    const sourceUrl = getNullableTextField(formData, "sourceUrl");
    const validFrom = getNullableTextField(formData, "validFrom");
    const validUntil = getNullableTextField(formData, "validUntil");
    const file = formData.get("file");

    if (!title) {
      return NextResponse.json(
        { error: "Informe o título do documento." },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Envie um arquivo válido." },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "O arquivo enviado está vazio." },
        { status: 400 },
      );
    }

    if (file.size > getMaxUploadBytes()) {
      return NextResponse.json(
        { error: "O arquivo excede o limite permitido para o Governança." },
        { status: 400 },
      );
    }

    const bucket =
      process.env.SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET ||
      process.env.NEXT_PUBLIC_SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET ||
      DEFAULT_BUCKET;

    const safeFileName = sanitizeFileName(file.name || "documento");
    const timestamp = Date.now();
    const storagePath = `${context.organization.id}/institutional/${timestamp}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("[governance] Erro ao enviar documento:", uploadError);

      return NextResponse.json(
        {
          error:
            "Não foi possível enviar o arquivo. Verifique o bucket e as políticas do Supabase Storage.",
        },
        { status: 500 },
      );
    }

    const { data: document, error: insertError } = await supabase
      .from("institutional_documents")
      .insert({
        organization_id: context.organization.id,
        uploaded_by: user.id,
        title,
        document_type: documentType,
        category,
        source_name: sourceName,
        source_url: sourceUrl,
        valid_from: validFrom,
        valid_until: validUntil,
        storage_bucket: bucket,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        extracted_text: null,
        indexing_status: "pending",
        review_status: "pending_review",
        metadata: {
          original_file_name: file.name,
          uploaded_from: "governance_base_institucional",
        },
      })
      .select(
        `
          id,
          organization_id,
          official_source_id,
          uploaded_by,
          reviewed_by,
          title,
          document_type,
          category,
          source_name,
          source_url,
          valid_from,
          valid_until,
          storage_bucket,
          storage_path,
          file_name,
          file_size,
          mime_type,
          extracted_text,
          indexing_status,
          review_status,
          metadata,
          reviewed_at,
          indexed_at,
          created_at,
          updated_at
        `,
      )
      .single();

    if (insertError) {
      console.error(
        "[governance] Erro ao registrar documento institucional:",
        insertError,
      );

      await supabase.storage.from(bucket).remove([storagePath]);

      return NextResponse.json(
        { error: "Arquivo enviado, mas não foi possível registrar o documento." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      document,
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao cadastrar documento institucional:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao cadastrar documento institucional." },
      { status: 500 },
    );
  }
}
