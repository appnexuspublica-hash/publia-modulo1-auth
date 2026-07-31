import { createHash } from "crypto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";
import { HtmlOfficialGazetteConnector } from "@/lib/governance/connectors/official-gazette";
import { extractOfficialGazetteMetadataFromPdfBuffer } from "@/lib/governance/official-gazette/extract-pdf-metadata";
import {
  fetchOfficialGazettePdf,
  OfficialGazetteRemoteAccessError,
} from "@/lib/governance/security/official-gazette-remote-access";
import { POST as processOfficialGazetteDocument } from "../../official-gazette-documents/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type ExistingDocument = {
  id: string;
  title: string;
  pdf_url: string | null;
  storage_path: string | null;
  edition_number: string | null;
  publication_date: string | null;
  file_hash: string | null;
};

function createWritableSupabaseRouteClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );
}

function normalizeNullable(value: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeEditionOrder(value: string | null) {
  const normalized = normalizeNullable(value);
  if (!normalized) return null;

  const numericValue = Number.parseInt(normalized.replace(/\D/g, ""), 10);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildDocumentTitle(editionNumber: string | null, fallbackTitle: string) {
  if (editionNumber) return `Diário Oficial nº ${editionNumber}`;
  return fallbackTitle || "Diário Oficial";
}

function createSha256Hex(fileBuffer: Buffer) {
  return createHash("sha256").update(new Uint8Array(fileBuffer)).digest("hex");
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isCandidateNewer({
  editionNumber,
  publicationDate,
  latestEdition,
  latestPublicationDate,
}: {
  editionNumber: string | null;
  publicationDate: string | null;
  latestEdition: number | null;
  latestPublicationDate: string | null;
}) {
  const candidateEdition = normalizeEditionOrder(editionNumber);

  if (candidateEdition !== null && latestEdition !== null) {
    return candidateEdition > latestEdition;
  }

  if (publicationDate && latestPublicationDate) {
    return publicationDate > latestPublicationDate;
  }

  return false;
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

    if (
      !["owner", "admin", "manager"].includes(
        context.membership.technical_role,
      )
    ) {
      return NextResponse.json(
        { error: "Seu perfil não pode sincronizar o Diário Oficial." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const gazetteId =
      typeof body?.gazetteId === "string" ? body.gazetteId.trim() : "";

    if (!gazetteId) {
      return NextResponse.json(
        { error: "Selecione a fonte do Diário Oficial." },
        { status: 400 },
      );
    }

    const { data: gazette, error: gazetteError } = await supabase
      .from("governance_official_gazettes")
      .select("id, url, active")
      .eq("id", gazetteId)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (gazetteError) {
      console.error(
        "[governance] Erro ao carregar fonte para sincronização:",
        gazetteError,
      );

      return NextResponse.json(
        { error: "Não foi possível carregar a fonte do Diário Oficial." },
        { status: 500 },
      );
    }

    if (!gazette || !gazette.active) {
      return NextResponse.json(
        { error: "Fonte ativa do Diário Oficial não encontrada." },
        { status: 404 },
      );
    }

    const { data: existingDocumentsData, error: documentsError } =
      await supabase
        .from("governance_official_gazette_documents")
        .select(
          "id, title, pdf_url, storage_path, edition_number, publication_date, file_hash",
        )
        .eq("organization_id", context.organization.id)
        .eq("gazette_id", gazette.id)
        .eq("active", true);

    if (documentsError) {
      console.error(
        "[governance] Erro ao comparar edições existentes:",
        documentsError,
      );

      return NextResponse.json(
        { error: "Não foi possível comparar as edições encontradas." },
        { status: 500 },
      );
    }

    const existingDocuments =
      (existingDocumentsData ?? []) as ExistingDocument[];

    const existingHashes = new Set(
      existingDocuments
        .map((item) => normalizeNullable(item.file_hash))
        .filter((value): value is string => Boolean(value)),
    );

    const existingUrls = new Set(
      existingDocuments
        .map((item) => normalizeNullable(item.pdf_url))
        .filter((value): value is string => Boolean(value)),
    );

    const latestEdition =
      existingDocuments.reduce<number | null>((latest, item) => {
        const current = normalizeEditionOrder(item.edition_number);
        if (current === null) return latest;
        return latest === null || current > latest ? current : latest;
      }, null);

    const latestPublicationDate =
      existingDocuments.reduce<string | null>((latest, item) => {
        const current = normalizeNullable(item.publication_date);
        if (!current) return latest;
        return !latest || current > latest ? current : latest;
      }, null);

    const connector = new HtmlOfficialGazetteConnector();
    const discovered = await connector.discover(gazette.url);

    /*
     * Os conectores preservam a ordem publicada no portal. Em portais que
     * exibem a edição mais recente primeiro, a primeira URL já cadastrada é o
     * marco seguro para interromper a varredura e impedir importação histórica.
     */
    const firstExistingUrlIndex = discovered.findIndex((edition) =>
      existingUrls.has(edition.pdfUrl),
    );

    const candidates =
      firstExistingUrlIndex >= 0
        ? discovered.slice(0, firstExistingUrlIndex)
        : discovered;

    const imported: Array<{
      title: string;
      pdfUrl: string;
      editionNumber: string | null;
      publicationDate: string | null;
    }> = [];

    const skipped: Array<{ title: string; reason: string }> = [];
    const failed: Array<{ title: string; error: string }> = [];
    let stoppedByMetadataCutoff = false;

    if (firstExistingUrlIndex >= 0) {
      skipped.push({
        title: discovered[firstExistingUrlIndex]?.title ?? "Diário Oficial",
        reason: "Marco de corte encontrado por URL já cadastrada.",
      });
    }

    for (const edition of candidates) {
      try {
        const { fileBuffer, finalUrl } = await fetchOfficialGazettePdf(
          edition.pdfUrl,
          gazette.url,
        );
        const fileHash = createSha256Hex(fileBuffer);

        if (existingHashes.has(fileHash)) {
          skipped.push({
            title: edition.title,
            reason: "Conteúdo do PDF já cadastrado; varredura interrompida.",
          });
          stoppedByMetadataCutoff = true;
          break;
        }

        const metadata =
          await extractOfficialGazetteMetadataFromPdfBuffer(fileBuffer);

        if (!metadata.editionNumber && !metadata.publicationDate) {
          skipped.push({
            title: edition.title,
            reason:
              "Número e data não foram encontrados no PDF; documento não importado por segurança.",
          });
          continue;
        }

        if (
          !isCandidateNewer({
            editionNumber: metadata.editionNumber,
            publicationDate: metadata.publicationDate,
            latestEdition,
            latestPublicationDate,
          })
        ) {
          skipped.push({
            title: buildDocumentTitle(
              metadata.editionNumber,
              edition.title,
            ),
            reason:
              "Marco de corte alcançado por número/data; varredura interrompida.",
          });
          stoppedByMetadataCutoff = true;
          break;
        }

        const title = buildDocumentTitle(
          metadata.editionNumber,
          edition.title,
        );

        const fileName =
          safeDecodeURIComponent(
            new URL(finalUrl).pathname.split("/").pop() ||
              "diario-oficial.pdf",
          );

        const formData = new FormData();
        formData.append("gazetteId", gazette.id);
        formData.append("title", title);
        formData.append(
          "editionNumber",
          metadata.editionNumber ?? "",
        );
        formData.append(
          "publicationDate",
          metadata.publicationDate ?? "",
        );
        formData.append(
          "file",
          new File([fileBuffer], fileName, {
            type: "application/pdf",
          }),
        );

        const pipelineRequest = new Request(
          new URL(
            "/api/governance/official-gazette-documents",
            request.url,
          ),
          {
            method: "POST",
            headers: {
              cookie: request.headers.get("cookie") ?? "",
            },
            body: formData,
          },
        );

        const pipelineResponse =
          await processOfficialGazetteDocument(pipelineRequest);
        const payload = await pipelineResponse.json();

        if (pipelineResponse.status === 409) {
          skipped.push({
            title,
            reason: payload?.error ?? "PDF já cadastrado.",
          });
          existingHashes.add(fileHash);
          continue;
        }

        if (!pipelineResponse.ok) {
          throw new Error(
            payload?.error ?? "Falha no pipeline do Diário Oficial.",
          );
        }

        imported.push({
          title,
          pdfUrl: finalUrl,
          editionNumber: metadata.editionNumber,
          publicationDate: metadata.publicationDate,
        });

        existingHashes.add(fileHash);
        existingUrls.add(edition.pdfUrl);
      } catch (error) {
        failed.push({
          title: edition.title,
          error:
            error instanceof Error
              ? error.message
              : "Erro inesperado.",
        });
      }
    }

    const synchronizedAt = new Date().toISOString();

    await supabase
      .from("governance_official_gazettes")
      .update({ last_sync_at: synchronizedAt })
      .eq("id", gazette.id)
      .eq("organization_id", context.organization.id);

    return NextResponse.json({
      discovered: discovered.length,
      candidates: candidates.length,
      imported,
      skipped,
      failed,
      cutoff: {
        editionNumber: latestEdition,
        publicationDate: latestPublicationDate,
        matchedExistingUrl: firstExistingUrlIndex >= 0,
        stoppedByMetadata: stoppedByMetadataCutoff,
      },
      synchronizedAt,
    });
  } catch (error) {
    console.error(
      "[governance] Erro na sincronização do Diário Oficial:",
      error,
    );

    const status =
      error instanceof OfficialGazetteRemoteAccessError
        ? error.code === "timeout"
          ? 504
          : ["dns_failure", "http_status", "network_failure"].includes(
                error.code,
              )
            ? 502
            : 400
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao verificar novas edições.",
      },
      { status },
    );
  }
}
