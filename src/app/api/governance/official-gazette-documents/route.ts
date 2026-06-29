// src/app/api/governance/official-gazette-documents/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createHash } from "crypto";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";
import {
  extractPdfTextFromBuffer,
  sanitizeExtractedText,
} from "@/lib/pdf/extract";
import { normalizeOfficialGazetteActs } from "@/lib/pdf/officialGazetteActNormalizer";

export const dynamic = "force-dynamic";

const DEFAULT_BUCKET = "governance-documents";
const MAX_CHUNK_CONTENT_LENGTH = 12_000;

type GazetteChunkDraft = {
  page_number: number | null;
  section_type: string;
  title: string;
  content: string;
};

const DOCUMENT_SELECT = `
  id,
  organization_id,
  gazette_id,
  title,
  edition_number,
  publication_date,
  pdf_url,
  storage_path,
  page_count,
  file_size,
  file_hash,
  indexing_status,
  extraction_status,
  active,
  created_at,
  updated_at
`;

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

function createSha256HexFromBuffer(fileBuffer: Buffer) {
  const bytes = new Uint8Array(fileBuffer);
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeGazetteText(raw: string) {
  return sanitizeExtractedText(raw)
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")

    // Assinatura/certificado D4Sign: normalmente fica na última página.
    // Esta limpeza precisa rodar antes e depois das remoções de cabeçalho,
    // porque o texto extraído pode vir com uma página inteira em uma única linha.
    .replace(/\b\d+\s*p[áa]ginas?\s*-\s*Datas\s+e\s+hor[aá]rios\s+baseados[\s\S]*$/i, "\n")
    .replace(/Eventos do documento[\s\S]*$/gi, "\n")
    .replace(/Hash do documento original[\s\S]*$/gi, "\n")
    .replace(/Esse documento está assinado[\s\S]*$/gi, "\n")
    .replace(/Esse log pertence[\s\S]*$/gi, "\n")
    .replace(/Integridade certificada[\s\S]*$/gi, "\n")

    // Cabeçalho e rodapé do Diário Oficial.
    // Importante: não usar [^\n]* nestes padrões, pois a extração por PDF
    // pode retornar uma página inteira em uma única linha. Se removermos até
    // o fim da linha, apagamos também Decreto, Portaria, Resolução etc.
    .replace(/Em conformidade com a Lei Municipal nº 015\/2011,\s*Lei Complementar Federal nº 101\/2000\s*e\s*Lei Complementar Estadual nº 351\/2011\.?/gi, "\n")
    .replace(/Prefeitura Municipal de Santana do Itararé\s*-\s*CNPJ:\s*76\.920\.826\/0001-30/gi, "\n")
    .replace(/Praça Frei Mathias de Genova nº 184\s*-\s*Centro\s*-\s*CEP\s*84970-000/gi, "\n")
    .replace(/Fone\/Fax:\s*\(43\)\s*3526-1458\s*-\s*E-mail:\s*publicacoes@santanadoitarare\.pr\.gov\.br/gi, "\n")
    .replace(/Site Oficial do Município:\s*www\.santanadoitarare\.pr\.gov\.br/gi, "\n")
    .replace(/A Prefeitura Municipal de Santana do Itararé,\s*da garantia de autenticidade desde documento,\s*desde que visualizado através do site:\s*https?:\/\/www\.santanadoitarare\.pr\.gov\.br\/diariooficial\/?/gi, "\n")
    .replace(/ANO:\s*\d{4}\s*\|\s*EDI[ÇC][ÃA]O\s*N[°º]\s*\d+\s*\|\s*SANTANA DO ITARAR[ÉE],?\s*[^|]*?\|\s*P[ÁA]GINA:\s*\d+/gi, "\n")
    .replace(/D4Sign\s+[^\n]+/gi, "\n")
    .replace(/Documento assinado eletronicamente[^\n]*/gi, "\n")
    .replace(/Para confirmar as assinaturas acesse[^\n]*/gi, "\n")
    .replace(/Código do documento[^\n]*/gi, "\n")
    .replace(/Certificado de assinaturas[^\n]*/gi, "\n")
    .replace(/Datas e hor[aá]rios baseados[^\n]*/gi, "\n")
    .replace(/Sincronizado com o NTP\.br[^\n]*/gi, "\n")
    .replace(/Observatório Nacional[^\n]*/gi, "\n")

    // Caso os blocos acima tenham revelado o começo do certificado.
    .replace(/\b\d+\s*p[áa]ginas?\s*-\s*Datas\s+e\s+hor[aá]rios\s+baseados[\s\S]*$/i, "\n")
    .replace(/Eventos do documento[\s\S]*$/gi, "\n")
    .replace(/Hash do documento original[\s\S]*$/gi, "\n")
    .replace(/Esse documento está assinado[\s\S]*$/gi, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectSectionType(title: string) {
  const normalizedTitle = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (normalizedTitle.includes("DECRETO")) return "decreto";
  if (normalizedTitle.includes("PORTARIA")) return "portaria";
  if (normalizedTitle.includes("RESOLUCAO")) return "resolucao";
  if (normalizedTitle.includes("LICITACAO")) return "licitacao";
  if (normalizedTitle.includes("DISPENSA")) return "licitacao";
  if (normalizedTitle.includes("INEXIGIBILIDADE")) return "licitacao";
  if (normalizedTitle.includes("CONTRATO")) return "contrato";
  if (normalizedTitle.includes("ATA")) return "ata";
  if (normalizedTitle.includes("NOMEIA") || normalizedTitle.includes("NOMEACAO")) return "nomeacao";
  if (normalizedTitle.includes("EXONERA") || normalizedTitle.includes("EXONERACAO")) return "exoneracao";
  if (normalizedTitle.includes("EDITAL")) return "edital";
  if (normalizedTitle.includes("AVISO")) return "aviso";
  if (normalizedTitle.includes("LEI")) return "lei";

  return "outro";
}

function getSectionTitle(content: string) {
  const firstMeaningfulLine =
    content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "Trecho do Diário Oficial";

  return firstMeaningfulLine.slice(0, 220);
}

function normalizeActTitle(title: string) {
  return String(title ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/N\s*[º°O.]\s*/gi, "Nº ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, " - ")
    .trim()
    .slice(0, 220);
}


function splitLongContent(content: string) {
  const normalizedContent = content.trim();

  if (normalizedContent.length <= MAX_CHUNK_CONTENT_LENGTH) {
    return [normalizedContent];
  }

  const parts: string[] = [];
  let remaining = normalizedContent;

  while (remaining.length > MAX_CHUNK_CONTENT_LENGTH) {
    const slice = remaining.slice(0, MAX_CHUNK_CONTENT_LENGTH);
    const lastBreak = Math.max(
      slice.lastIndexOf("\n\n"),
      slice.lastIndexOf(". "),
      slice.lastIndexOf("; "),
    );

    const cutAt =
      lastBreak > Math.floor(MAX_CHUNK_CONTENT_LENGTH * 0.55)
        ? lastBreak + 1
        : MAX_CHUNK_CONTENT_LENGTH;

    parts.push(remaining.slice(0, cutAt).trim());
    remaining = remaining.slice(cutAt).trim();
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts;
}

function getOfficialGazetteActHeaderPattern() {
  return new RegExp(
    [
      // Atos publicados: padrões fortes de início de ato.
      // Não incluir "Lei nº ..." genérico aqui, porque em Diários Municipais
      // muitas leis aparecem apenas como fundamento dentro de portarias/resoluções.
      String.raw`\bDECRETO\s+(?:MUNICIPAL\s+)?N[º°O.]?\s*[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`\bPORTARIA\s+N[º°O.]?\s*[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`\bRESOLU[ÇC][ÃA]O\s+(?:N[º°O.]?\s*)?[\d.]+(?:[/-]\d{2,4})?(?:\s+de\s+\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4})?`,
      String.raw`\bATA\s+DA\s+ABERTURA[\s\S]{0,260}?DISPENSA\s+DE\s+LICITA[ÇC][ÃA]O\s+[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`\bDISPENSA\s+DE\s+LICITA[ÇC][ÃA]O\s+[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`\bINEXIGIBILIDADE\s+DE\s+LICITA[ÇC][ÃA]O\s+[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`\bEXTRATO\s+DE\s+(?:CONTRATO|TERMO|ATA|DISPENSA|INEXIGIBILIDADE)\b[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ Nº°O./-]{0,120}`,
      String.raw`\bEDITAL\s+N[º°O.]?\s*[\d.]+(?:[/-]\d{2,4})?`,
      String.raw`\bAVISO\s+DE\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ ]{3,80}`,
      String.raw`\bTERMO\s+DE\s+(?:HOMOLOGA[ÇC][ÃA]O|ADJUDICA[ÇC][ÃA]O)[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ Nº°O./-]{0,120}`,
    ].join("|"),
    "gi",
  );
}

function splitOfficialGazetteActs(rawText: string): GazetteChunkDraft[] {
  return normalizeOfficialGazetteActs(rawText, {
    maxContentLength: MAX_CHUNK_CONTENT_LENGTH,
  }).map((chunk) => ({
    page_number: chunk.page_number,
    section_type: chunk.section_type,
    title: chunk.title,
    content: chunk.content,
  }));
}

async function processOfficialGazetteDocumentBuffer({
  supabase,
  organizationId,
  documentId,
  fileBuffer,
  fileSizeBytes,
}: {
  supabase: ReturnType<typeof createWritableSupabaseRouteClient>;
  organizationId: string;
  documentId: string;
  fileBuffer: Buffer;
  fileSizeBytes: number;
}) {
  await supabase
    .from("governance_official_gazette_documents")
    .update({
      extraction_status: "processing",
      indexing_status: "processing",
    })
    .eq("id", documentId)
    .eq("organization_id", organizationId);

  const { maxExtractBytes, maxExtractMb } = getMaxExtractBytes();

  const extraction = await extractPdfTextFromBuffer(fileBuffer, {
    fileSizeBytes,
    maxBytes: maxExtractBytes,
    maxMbLabel: maxExtractMb,
    // Diário Oficial costuma misturar texto selecionável com páginas escaneadas.
    // OCR preferencial evita perder atos publicados como imagem.
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

    const { data: updatedDocument } = await supabase
      .from("governance_official_gazette_documents")
      .update({
        extraction_status: nextExtractionStatus,
        indexing_status: nextIndexingStatus,
      })
      .eq("id", documentId)
      .eq("organization_id", organizationId)
      .select(DOCUMENT_SELECT)
      .single();

    return {
      document: updatedDocument,
      extraction: {
        ok: false,
        status: nextExtractionStatus,
        indexingStatus: nextIndexingStatus,
        message:
          extraction.kind === "no_text"
            ? "Não foi possível extrair texto do PDF."
            : extraction.error,
        chunksCount: 0,
      },
      httpStatus: 200,
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
      console.error(
        "[governance] Erro ao salvar trechos do Diário Oficial:",
        chunksError,
      );

      const { data: updatedDocument } = await supabase
        .from("governance_official_gazette_documents")
        .update({
          extraction_status: "completed",
          indexing_status: "error",
        })
        .eq("id", documentId)
        .eq("organization_id", organizationId)
        .select(DOCUMENT_SELECT)
        .single();

      return {
        document: updatedDocument,
        extraction: {
          ok: false,
          status: "completed",
          indexingStatus: "error",
          message: "Texto extraído, mas não foi possível salvar os trechos.",
          chunksCount: 0,
        },
        httpStatus: 500,
      };
    }
  }

  const { data: updatedDocument, error: updateError } = await supabase
    .from("governance_official_gazette_documents")
    .update({
      extraction_status: "completed",
      indexing_status: chunks.length > 0 ? "completed" : "empty",
    })
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .select(DOCUMENT_SELECT)
    .single();

  if (updateError) {
    console.error(
      "[governance] PDF processado, mas não foi possível atualizar status:",
      updateError,
    );
  }

  return {
    document: updatedDocument,
    extraction: {
      ok: true,
      status: "completed",
      indexingStatus: chunks.length > 0 ? "completed" : "empty",
      chunksCount: chunks.length,
    },
    httpStatus: 200,
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

export async function GET(request: Request) {
  try {
    const { supabase, context, response } =
      await getAuthenticatedGovernanceContext();

    if (response || !context) {
      return response;
    }

    const { searchParams } = new URL(request.url);
    const gazetteId = searchParams.get("gazetteId");

    let query = supabase
      .from("governance_official_gazette_documents")
      .select(
        `
          id,
          organization_id,
          gazette_id,
          title,
          edition_number,
          publication_date,
          pdf_url,
          storage_path,
          page_count,
          file_size,
          file_hash,
          indexing_status,
          extraction_status,
          active,
          created_at,
          updated_at
        `,
      )
      .eq("organization_id", context.organization.id)
      .eq("active", true)
      .order("edition_number", { ascending: false, nullsFirst: false })
      .order("publication_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (gazetteId) {
      query = query.eq("gazette_id", gazetteId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[governance] Erro ao listar PDFs do Diário Oficial:", error);

      return NextResponse.json(
        { error: "Não foi possível listar as edições do Diário Oficial." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      documents: data ?? [],
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao listar PDFs do Diário Oficial:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao listar as edições do Diário Oficial." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let uploadedFile:
    | {
        bucket: string;
        storagePath: string;
      }
    | null = null;

  try {
    const { supabase, user, context, response } =
      await getAuthenticatedGovernanceContext();

    if (response || !context || !user) {
      return response;
    }

    const allowedTechnicalRoles = ["owner", "admin", "manager"];

    if (!allowedTechnicalRoles.includes(context.membership.technical_role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode gerenciar o Diário Oficial." },
        { status: 403 },
      );
    }

    const formData = await request.formData();

    const gazetteId = getTextField(formData, "gazetteId");
    const title = getTextField(formData, "title");
    const editionNumber = getNullableTextField(formData, "editionNumber");
    const publicationDate = getNullableTextField(formData, "publicationDate");
    const file = formData.get("file");

    if (!gazetteId) {
      return NextResponse.json(
        { error: "Selecione a fonte do Diário Oficial." },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: "Informe o título da edição." },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Envie um arquivo PDF válido." },
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

    const fileType = file.type || "application/pdf";

    if (fileType !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Envie apenas arquivo PDF." },
        { status: 400 },
      );
    }

    const { data: gazette, error: gazetteError } = await supabase
      .from("governance_official_gazettes")
      .select("id, organization_id")
      .eq("id", gazetteId)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (gazetteError) {
      console.error("[governance] Erro ao validar fonte do Diário Oficial:", gazetteError);

      return NextResponse.json(
        { error: "Não foi possível validar a fonte do Diário Oficial." },
        { status: 500 },
      );
    }

    if (!gazette) {
      return NextResponse.json(
        { error: "Fonte do Diário Oficial não encontrada para esta organização." },
        { status: 404 },
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = await createSha256HexFromBuffer(fileBuffer);

    const { data: existingDocument, error: existingError } = await supabase
      .from("governance_official_gazette_documents")
      .select("id")
      .eq("organization_id", context.organization.id)
      .eq("file_hash", fileHash)
      .eq("active", true)
      .maybeSingle();

    if (existingError) {
      console.error("[governance] Erro ao verificar PDF duplicado:", existingError);

      return NextResponse.json(
        { error: "Não foi possível verificar se o PDF já foi cadastrado." },
        { status: 500 },
      );
    }

    if (existingDocument) {
      return NextResponse.json(
        { error: "Este PDF já foi cadastrado para esta organização." },
        { status: 409 },
      );
    }

    const bucket =
      process.env.SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET ||
      process.env.NEXT_PUBLIC_SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET ||
      DEFAULT_BUCKET;

    const safeFileName = sanitizeFileName(file.name || "diario-oficial.pdf");
    const timestamp = Date.now();
    const storagePath = `${context.organization.id}/official-gazette/${timestamp}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("[governance] Erro ao enviar PDF do Diário Oficial:", uploadError);

      return NextResponse.json(
        {
          error:
            "Não foi possível enviar o PDF. Verifique o bucket e as políticas do Supabase Storage.",
        },
        { status: 500 },
      );
    }

    uploadedFile = {
      bucket,
      storagePath,
    };

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    const { data: document, error: insertError } = await supabase
      .from("governance_official_gazette_documents")
      .insert({
        organization_id: context.organization.id,
        gazette_id: gazette.id,
        title,
        edition_number: editionNumber,
        publication_date: publicationDate,
        pdf_url: publicUrl || null,
        storage_path: storagePath,
        page_count: null,
        file_size: file.size,
        file_hash: fileHash,
        indexing_status: "processing",
        extraction_status: "processing",
        active: true,
      })
      .select(
        `
          id,
          organization_id,
          gazette_id,
          title,
          edition_number,
          publication_date,
          pdf_url,
          storage_path,
          page_count,
          file_size,
          file_hash,
          indexing_status,
          extraction_status,
          active,
          created_at,
          updated_at
        `,
      )
      .single();

    if (insertError) {
      console.error("[governance] Erro ao registrar PDF do Diário Oficial:", insertError);

      if (uploadedFile) {
        await supabase.storage.from(uploadedFile.bucket).remove([
          uploadedFile.storagePath,
        ]);
      }

      return NextResponse.json(
        { error: "PDF enviado, mas não foi possível registrar a edição." },
        { status: 500 },
      );
    }

    const { maxExtractBytes, maxExtractMb } = getMaxExtractBytes();

    const extraction = await extractPdfTextFromBuffer(fileBuffer, {
      fileSizeBytes: file.size,
      maxBytes: maxExtractBytes,
      maxMbLabel: maxExtractMb,
      // Diário Oficial costuma misturar texto selecionável com páginas escaneadas.
      // OCR preferencial evita perder atos publicados como imagem.
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
          ? "blocked_no_text"
          : extraction.kind === "skipped_large"
            ? "blocked_large"
            : "error";

      const { data: updatedDocument } = await supabase
        .from("governance_official_gazette_documents")
        .update({
          extraction_status: nextExtractionStatus,
          indexing_status: nextIndexingStatus,
        })
        .eq("id", document.id)
        .eq("organization_id", context.organization.id)
        .select(
          `
            id,
            organization_id,
            gazette_id,
            title,
            edition_number,
            publication_date,
            pdf_url,
            storage_path,
            page_count,
            file_size,
            file_hash,
            indexing_status,
            extraction_status,
            active,
            created_at,
            updated_at
          `,
        )
        .single();

      return NextResponse.json({
        document: updatedDocument ?? document,
        extraction: {
          ok: false,
          status: nextExtractionStatus,
          indexingStatus: nextIndexingStatus,
          message: extraction.kind === "no_text" ? "Não foi possível extrair texto do PDF." : extraction.error,
          chunksCount: 0,
        },
      });
    }

    const chunks = splitOfficialGazetteActs(extraction.text);

    await supabase
      .from("governance_official_gazette_chunks")
      .delete()
      .eq("document_id", document.id)
      .eq("organization_id", context.organization.id);

    if (chunks.length > 0) {
      const { error: chunksError } = await supabase
        .from("governance_official_gazette_chunks")
        .insert(
          chunks.map((chunk) => ({
            document_id: document.id,
            organization_id: context.organization.id,
            page_number: chunk.page_number,
            section_type: chunk.section_type,
            title: chunk.title,
            content: chunk.content,
          })),
        );

      if (chunksError) {
        console.error(
          "[governance] Erro ao salvar trechos do Diário Oficial:",
          chunksError,
        );

        const { data: updatedDocument } = await supabase
          .from("governance_official_gazette_documents")
          .update({
            extraction_status: "completed",
            indexing_status: "error",
          })
          .eq("id", document.id)
          .eq("organization_id", context.organization.id)
          .select(
            `
              id,
              organization_id,
              gazette_id,
              title,
              edition_number,
              publication_date,
              pdf_url,
              storage_path,
              page_count,
              file_size,
              file_hash,
              indexing_status,
              extraction_status,
              active,
              created_at,
              updated_at
            `,
          )
          .single();

        return NextResponse.json(
          {
            document: updatedDocument ?? document,
            extraction: {
              ok: false,
              status: "completed",
              indexingStatus: "error",
              message: "Texto extraído, mas não foi possível salvar os trechos.",
              chunksCount: 0,
            },
          },
          { status: 500 },
        );
      }
    }

    const { data: updatedDocument, error: updateError } = await supabase
      .from("governance_official_gazette_documents")
      .update({
        extraction_status: "completed",
        indexing_status: chunks.length > 0 ? "completed" : "empty",
      })
      .eq("id", document.id)
      .eq("organization_id", context.organization.id)
      .select(
        `
          id,
          organization_id,
          gazette_id,
          title,
          edition_number,
          publication_date,
          pdf_url,
          storage_path,
          page_count,
          file_size,
          file_hash,
          indexing_status,
          extraction_status,
          active,
          created_at,
          updated_at
        `,
      )
      .single();

    if (updateError) {
      console.error(
        "[governance] PDF processado, mas não foi possível atualizar status:",
        updateError,
      );
    }

    return NextResponse.json({
      document: updatedDocument ?? document,
      extraction: {
        ok: true,
        status: "completed",
        indexingStatus: chunks.length > 0 ? "completed" : "empty",
        chunksCount: chunks.length,
      },
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao cadastrar PDF do Diário Oficial:",
      error,
    );

    if (uploadedFile) {
      const supabase = createWritableSupabaseRouteClient();
      await supabase.storage.from(uploadedFile.bucket).remove([
        uploadedFile.storagePath,
      ]);
    }

    return NextResponse.json(
      { error: "Erro inesperado ao cadastrar PDF do Diário Oficial." },
      { status: 500 },
    );
  }
}


export async function PATCH(request: Request) {
  try {
    const { supabase, context, response } =
      await getAuthenticatedGovernanceContext();

    if (response || !context) {
      return response;
    }

    const allowedTechnicalRoles = ["owner", "admin", "manager"];

    if (!allowedTechnicalRoles.includes(context.membership.technical_role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode reprocessar o Diário Oficial." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const documentId =
      typeof body?.documentId === "string" ? body.documentId.trim() : "";

    if (!documentId) {
      return NextResponse.json(
        { error: "Informe a edição do Diário Oficial." },
        { status: 400 },
      );
    }

    const { data: document, error: documentError } = await supabase
      .from("governance_official_gazette_documents")
      .select(DOCUMENT_SELECT)
      .eq("id", documentId)
      .eq("organization_id", context.organization.id)
      .eq("active", true)
      .maybeSingle();

    if (documentError) {
      console.error(
        "[governance] Erro ao buscar edição do Diário Oficial:",
        documentError,
      );

      return NextResponse.json(
        { error: "Não foi possível localizar a edição." },
        { status: 500 },
      );
    }

    if (!document) {
      return NextResponse.json(
        { error: "Edição do Diário Oficial não encontrada." },
        { status: 404 },
      );
    }

    if (!document.storage_path) {
      return NextResponse.json(
        { error: "Esta edição não possui arquivo PDF armazenado." },
        { status: 400 },
      );
    }

    const { data: downloadedFile, error: downloadError } =
      await supabase.storage.from(DEFAULT_BUCKET).download(document.storage_path);

    if (downloadError || !downloadedFile) {
      console.error(
        "[governance] Erro ao baixar PDF do Diário Oficial para reprocessar:",
        downloadError,
      );

      return NextResponse.json(
        { error: "Não foi possível baixar o PDF para reprocessamento." },
        { status: 500 },
      );
    }

    const fileArrayBuffer = await downloadedFile.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);

    const result = await processOfficialGazetteDocumentBuffer({
      supabase,
      organizationId: context.organization.id,
      documentId: document.id,
      fileBuffer,
      fileSizeBytes:
        typeof document.file_size === "number"
          ? document.file_size
          : downloadedFile.size,
    });

    return NextResponse.json(
      {
        document: result.document ?? document,
        extraction: result.extraction,
      },
      { status: result.httpStatus },
    );
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao reprocessar PDF do Diário Oficial:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao reprocessar PDF do Diário Oficial." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, context, response } =
      await getAuthenticatedGovernanceContext();

    if (response || !context) {
      return response;
    }

    const allowedTechnicalRoles = ["owner", "admin", "manager"];

    if (!allowedTechnicalRoles.includes(context.membership.technical_role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode excluir edições do Diário Oficial." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const documentId =
      typeof body?.documentId === "string" ? body.documentId.trim() : "";

    if (!documentId) {
      return NextResponse.json(
        { error: "Informe a edição do Diário Oficial." },
        { status: 400 },
      );
    }

    const { data: document, error: documentError } = await supabase
      .from("governance_official_gazette_documents")
      .select(DOCUMENT_SELECT)
      .eq("id", documentId)
      .eq("organization_id", context.organization.id)
      .eq("active", true)
      .maybeSingle();

    if (documentError) {
      console.error(
        "[governance] Erro ao buscar edição do Diário Oficial para excluir:",
        documentError,
      );

      return NextResponse.json(
        { error: "Não foi possível localizar a edição." },
        { status: 500 },
      );
    }

    if (!document) {
      return NextResponse.json(
        { error: "Edição do Diário Oficial não encontrada." },
        { status: 404 },
      );
    }

    const { error: chunksError } = await supabase
      .from("governance_official_gazette_chunks")
      .delete()
      .eq("document_id", document.id)
      .eq("organization_id", context.organization.id);

    if (chunksError) {
      console.error(
        "[governance] Erro ao excluir trechos da edição do Diário Oficial:",
        chunksError,
      );

      return NextResponse.json(
        { error: "Não foi possível excluir os trechos da edição." },
        { status: 500 },
      );
    }

    if (document.storage_path) {
      const { error: storageError } = await supabase.storage
        .from(DEFAULT_BUCKET)
        .remove([document.storage_path]);

      if (storageError) {
        console.warn(
          "[governance] Edição marcada como excluída, mas o PDF não foi removido do Storage:",
          storageError,
        );
      }
    }

    const { error: updateError } = await supabase
      .from("governance_official_gazette_documents")
      .update({
        active: false,
      })
      .eq("id", document.id)
      .eq("organization_id", context.organization.id);

    if (updateError) {
      console.error(
        "[governance] Erro ao marcar edição do Diário Oficial como excluída:",
        updateError,
      );

      return NextResponse.json(
        { error: "Não foi possível excluir a edição." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      documentId: document.id,
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao excluir edição do Diário Oficial:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao excluir edição do Diário Oficial." },
      { status: 500 },
    );
  }
}
