// src/app/api/governance/official-gazette/sync/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";
import { discoverOfficialGazetteEditions } from "@/lib/governance/officialGazetteCrawler";
import {
  extractPdfTextFromBuffer,
  sanitizeExtractedText,
} from "@/lib/pdf/extract";
import { normalizeOfficialGazetteActs } from "@/lib/pdf/officialGazetteActNormalizer";

export const dynamic = "force-dynamic";

const DEFAULT_BUCKET = "governance-documents";
const MAX_CHUNK_CONTENT_LENGTH = 12_000;

type SyncRequestPayload = {
  gazetteId?: unknown;
  limit?: unknown;
};

type GazetteRow = {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  active: boolean;
};

type SupabaseLikeClient = ReturnType<typeof createWritableSupabaseRouteClient>;

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

function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBucketName() {
  return (
    process.env.SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET ||
    DEFAULT_BUCKET
  );
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLimit(value: unknown) {
  const parsedValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 10;

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 10;
  }

  return Math.min(Math.floor(parsedValue), 25);
}

function isCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const tokenHeader = request.headers.get("x-cron-secret");

  return authHeader === `Bearer ${cronSecret}` || tokenHeader === cronSecret;
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

function getFileNameFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const parts = parsedUrl.pathname.split("/");
    return decodeURIComponent(parts[parts.length - 1] ?? "diario-oficial.pdf");
  } catch {
    return "diario-oficial.pdf";
  }
}

function createSha256HexFromBuffer(fileBuffer: Buffer) {
  const bytes = new Uint8Array(fileBuffer);
  return createHash("sha256").update(bytes).digest("hex");
}

function getMaxExtractBytes() {
  const configuredValue = Number(process.env.PDF_EXTRACT_MAX_MB ?? "48");
  const maxExtractMb =
    Number.isFinite(configuredValue) && configuredValue > 0
      ? configuredValue
      : 48;

  return {
    maxExtractMb,
    maxExtractBytes: maxExtractMb * 1024 * 1024,
  };
}

function normalizeGazetteText(raw: string) {
  return sanitizeExtractedText(raw)
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\b\d+\s*p[áa]ginas?\s*-\s*Datas\s+e\s+hor[aá]rios\s+baseados[\s\S]*$/i, "\n")
    .replace(/Eventos do documento[\s\S]*$/i, "\n")
    .replace(/Esse documento est[áa] assinado[\s\S]*$/i, "\n")
    .replace(/D4Sign[\s\S]{0,220}?Brasil/gi, "\n")
    .replace(/Documento assinado eletronicamente[\s\S]{0,160}?Brasil/gi, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitOfficialGazetteActs(rawText: string) {
  const normalizedText = normalizeGazetteText(rawText);

  return normalizeOfficialGazetteActs(normalizedText, {
    maxContentLength: MAX_CHUNK_CONTENT_LENGTH,
  }).map((chunk) => ({
    page_number: chunk.page_number,
    section_type: chunk.section_type,
    title: chunk.title,
    content: chunk.content,
  }));
}

async function downloadPdf(pdfUrl: string) {
  const response = await fetch(pdfUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Publ.IA Governance Official Gazette Sync/1.0",
      Accept: "application/pdf,*/*",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Não foi possível baixar o PDF (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (
    contentType &&
    !contentType.toLowerCase().includes("application/pdf") &&
    !pdfUrl.toLowerCase().includes(".pdf")
  ) {
    throw new Error("O arquivo encontrado não parece ser um PDF.");
  }

  const fileBuffer = Buffer.from(await response.arrayBuffer());

  if (fileBuffer.length <= 0) {
    throw new Error("O PDF encontrado está vazio.");
  }

  return fileBuffer;
}

async function processDownloadedPdf({
  supabase,
  organizationId,
  documentId,
  fileBuffer,
}: {
  supabase: SupabaseLikeClient;
  organizationId: string;
  documentId: string;
  fileBuffer: Buffer;
}) {
  const { maxExtractBytes, maxExtractMb } = getMaxExtractBytes();

  const extraction = await extractPdfTextFromBuffer(fileBuffer, {
    fileSizeBytes: fileBuffer.length,
    maxBytes: maxExtractBytes,
    maxMbLabel: maxExtractMb,
    preferOcr: true,
  });

  if (extraction.kind !== "ready") {
    const nextExtractionStatus =
      extraction.kind === "no_text"
        ? "no_text"
        : extraction.kind === "skipped_large"
          ? "skipped_large"
          : "error";

    const nextIndexingStatus =
      extraction.kind === "no_text"
        ? "empty"
        : extraction.kind === "skipped_large"
          ? "skipped"
          : "error";

    await supabase
      .from("governance_official_gazette_documents")
      .update({
        extraction_status: nextExtractionStatus,
        indexing_status: nextIndexingStatus,
      })
      .eq("id", documentId)
      .eq("organization_id", organizationId);

    return {
      ok: false,
      chunksCount: 0,
      status: nextExtractionStatus,
      indexingStatus: nextIndexingStatus,
    };
  }

  const chunks = splitOfficialGazetteActs(extraction.text);

  await supabase
    .from("governance_official_gazette_chunks")
    .delete()
    .eq("document_id", documentId)
    .eq("organization_id", organizationId);

  if (chunks.length > 0) {
    const { error: chunksError } = await supabase
      .from("governance_official_gazette_chunks")
      .insert(
        chunks.map((chunk) => ({
          document_id: documentId,
          organization_id: organizationId,
          page_number: chunk.page_number,
          section_type: chunk.section_type,
          title: chunk.title,
          content: chunk.content,
        })),
      );

    if (chunksError) {
      console.error("[governance] Erro ao salvar atos sincronizados:", chunksError);

      await supabase
        .from("governance_official_gazette_documents")
        .update({
          extraction_status: "completed",
          indexing_status: "error",
        })
        .eq("id", documentId)
        .eq("organization_id", organizationId);

      return {
        ok: false,
        chunksCount: 0,
        status: "completed",
        indexingStatus: "error",
      };
    }
  }

  await supabase
    .from("governance_official_gazette_documents")
    .update({
      extraction_status: "completed",
      indexing_status: chunks.length > 0 ? "completed" : "empty",
    })
    .eq("id", documentId)
    .eq("organization_id", organizationId);

  return {
    ok: true,
    chunksCount: chunks.length,
    status: "completed",
    indexingStatus: chunks.length > 0 ? "completed" : "empty",
  };
}

async function syncGazetteSource({
  supabase,
  gazette,
  limit,
}: {
  supabase: SupabaseLikeClient;
  gazette: GazetteRow;
  limit: number;
}) {
  const discoveredEditions = await discoverOfficialGazetteEditions(gazette.url);
  const limitedEditions = discoveredEditions.slice(0, limit);
  const results: Array<{
    title: string;
    editionNumber: string | null;
    status: "created" | "skipped" | "error";
    message?: string;
    chunksCount?: number;
  }> = [];

  for (const edition of limitedEditions) {
    try {
      let existingQuery = supabase
        .from("governance_official_gazette_documents")
        .select("id")
        .eq("organization_id", gazette.organization_id)
        .eq("gazette_id", gazette.id)
        .eq("active", true)
        .limit(1);

      if (edition.editionNumber) {
        existingQuery = existingQuery.eq("edition_number", edition.editionNumber);
      } else {
        existingQuery = existingQuery.eq("pdf_url", edition.pdfUrl);
      }

      const { data: existingDocument, error: existingError } =
        await existingQuery.maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingDocument) {
        results.push({
          title: edition.title,
          editionNumber: edition.editionNumber,
          status: "skipped",
          message: "Edição já cadastrada.",
        });
        continue;
      }

      const fileBuffer = await downloadPdf(edition.pdfUrl);
      const fileHash = createSha256HexFromBuffer(fileBuffer);

      const { data: existingHash, error: hashError } = await supabase
        .from("governance_official_gazette_documents")
        .select("id")
        .eq("organization_id", gazette.organization_id)
        .eq("file_hash", fileHash)
        .maybeSingle();

      if (hashError) {
        throw hashError;
      }

      if (existingHash) {
        results.push({
          title: edition.title,
          editionNumber: edition.editionNumber,
          status: "skipped",
          message: "PDF já cadastrado para esta organização.",
        });
        continue;
      }

      const bucket = getBucketName();
      const safeFileName = sanitizeFileName(getFileNameFromUrl(edition.pdfUrl));
      const timestamp = Date.now();
      const storagePath = `${gazette.organization_id}/official-gazette/auto-${timestamp}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(storagePath);

      const { data: document, error: insertError } = await supabase
        .from("governance_official_gazette_documents")
        .insert({
          organization_id: gazette.organization_id,
          gazette_id: gazette.id,
          title: edition.title,
          edition_number: edition.editionNumber,
          publication_date: edition.publicationDate,
          pdf_url: publicUrl || edition.pdfUrl,
          public_url: edition.pdfUrl,
          source_page_url: edition.sourcePageUrl,
          storage_path: storagePath,
          page_count: null,
          file_size: fileBuffer.length,
          file_hash: fileHash,
          indexing_status: "processing",
          extraction_status: "processing",
          active: true,
        })
        .select("id")
        .single();

      if (insertError || !document) {
        await supabase.storage.from(bucket).remove([storagePath]);
        throw insertError ?? new Error("Não foi possível registrar a edição.");
      }

      const processingResult = await processDownloadedPdf({
        supabase,
        organizationId: gazette.organization_id,
        documentId: document.id,
        fileBuffer,
      });

      results.push({
        title: edition.title,
        editionNumber: edition.editionNumber,
        status: "created",
        message: processingResult.ok
          ? "Edição sincronizada e indexada."
          : "Edição cadastrada, mas a indexação precisa de revisão.",
        chunksCount: processingResult.chunksCount,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro inesperado ao sincronizar edição.";

      console.error("[governance] Erro ao sincronizar edição do Diário Oficial:", {
        gazetteId: gazette.id,
        edition,
        error,
      });

      results.push({
        title: edition.title,
        editionNumber: edition.editionNumber,
        status: "error",
        message,
      });
    }
  }

  await supabase
    .from("governance_official_gazettes")
    .update({
      last_sync_at: new Date().toISOString(),
    })
    .eq("id", gazette.id)
    .eq("organization_id", gazette.organization_id);

  return {
    gazetteId: gazette.id,
    gazetteName: gazette.name,
    discovered: discoveredEditions.length,
    processed: limitedEditions.length,
    created: results.filter((item) => item.status === "created").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    errors: results.filter((item) => item.status === "error").length,
    results,
  };
}

async function getAuthenticatedGovernanceContext() {
  const supabase = createWritableSupabaseRouteClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      context: null,
      response: NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      ),
    };
  }

  const context = await getCurrentGovernanceOrganization(user.id);

  if (!context) {
    return {
      supabase,
      user,
      context: null,
      response: NextResponse.json(
        { error: "Usuário não vinculado a uma organização ativa." },
        { status: 403 },
      ),
    };
  }

  return {
    supabase,
    user,
    context,
    response: null,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SyncRequestPayload;
    const gazetteId = normalizeText(body?.gazetteId);
    const limit = normalizeLimit(body?.limit);

    if (isCronRequest(request)) {
      const supabase = createAdminSupabaseClient();

      if (!supabase) {
        return NextResponse.json(
          {
            error:
              "SUPABASE_SERVICE_ROLE_KEY não configurada para sincronização automática.",
          },
          { status: 500 },
        );
      }

      const { data: gazettes, error } = await supabase
        .from("governance_official_gazettes")
        .select("id, organization_id, name, url, active")
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[governance] Erro ao listar fontes para cron:", error);

        return NextResponse.json(
          { error: "Não foi possível listar fontes para sincronização." },
          { status: 500 },
        );
      }

      const summaries = [];

      for (const gazette of (gazettes ?? []) as GazetteRow[]) {
        summaries.push(
          await syncGazetteSource({
            supabase: supabase as unknown as SupabaseLikeClient,
            gazette,
            limit,
          }),
        );
      }

      return NextResponse.json({
        ok: true,
        mode: "cron",
        sources: summaries.length,
        summaries,
      });
    }

    const { supabase, context, response } =
      await getAuthenticatedGovernanceContext();

    if (response || !context) {
      return response;
    }

    const allowedTechnicalRoles = ["owner", "admin", "manager"];

    if (!allowedTechnicalRoles.includes(context.membership.technical_role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode sincronizar o Diário Oficial." },
        { status: 403 },
      );
    }

    let query = supabase
      .from("governance_official_gazettes")
      .select("id, organization_id, name, url, active")
      .eq("organization_id", context.organization.id)
      .eq("active", true);

    if (gazetteId) {
      query = query.eq("id", gazetteId);
    }

    const { data: gazettes, error } = await query;

    if (error) {
      console.error("[governance] Erro ao listar fontes para sincronizar:", error);

      return NextResponse.json(
        { error: "Não foi possível localizar fontes do Diário Oficial." },
        { status: 500 },
      );
    }

    const activeGazettes = (gazettes ?? []) as GazetteRow[];

    if (activeGazettes.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma fonte ativa encontrada para sincronização." },
        { status: 404 },
      );
    }

    const summaries = [];

    for (const gazette of activeGazettes) {
      summaries.push(
        await syncGazetteSource({
          supabase,
          gazette,
          limit,
        }),
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "manual",
      sources: summaries.length,
      summaries,
    });
  } catch (error) {
    console.error("[governance] Erro inesperado na sincronização:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao sincronizar o Diário Oficial.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
