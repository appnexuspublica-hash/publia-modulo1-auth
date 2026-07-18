import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";
import { extractOfficialGazetteMetadataFromPdfBuffer } from "@/lib/governance/official-gazette/extract-pdf-metadata";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type DocumentWithoutMetadata = {
  id: string;
  title: string;
  pdf_url: string | null;
  edition_number: string | null;
  publication_date: string | null;
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

function buildDocumentTitle(editionNumber: string | null, fallbackTitle: string) {
  if (editionNumber) return `Diário Oficial nº ${editionNumber}`;
  return fallbackTitle || "Diário Oficial";
}

async function downloadPdf(pdfUrl: string) {
  const response = await fetch(pdfUrl, {
    cache: "no-store",
    headers: {
      "User-Agent": "Publ.IA/6.1 (+correcao-metadados-diario-oficial)",
      Accept: "application/pdf",
    },
  });

  if (!response.ok) {
    throw new Error(`Download respondeu com status ${response.status}.`);
  }

  const fileBuffer = Buffer.from(await response.arrayBuffer());

  if (fileBuffer.length === 0) {
    throw new Error("O PDF armazenado está vazio.");
  }

  return fileBuffer;
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
        { error: "Seu perfil não pode corrigir metadados do Diário Oficial." },
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

    const { data: gazette } = await supabase
      .from("governance_official_gazettes")
      .select("id")
      .eq("id", gazetteId)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (!gazette) {
      return NextResponse.json(
        { error: "Fonte do Diário Oficial não encontrada." },
        { status: 404 },
      );
    }

    const { data, error: documentsError } = await supabase
      .from("governance_official_gazette_documents")
      .select("id, title, pdf_url, edition_number, publication_date")
      .eq("organization_id", context.organization.id)
      .eq("gazette_id", gazette.id)
      .eq("active", true)
      .is("edition_number", null);

    if (documentsError) {
      console.error(
        "[governance] Erro ao carregar edições sem número:",
        documentsError,
      );

      return NextResponse.json(
        { error: "Não foi possível carregar as edições sem número." },
        { status: 500 },
      );
    }

    const documents = (data ?? []) as DocumentWithoutMetadata[];
    const updated: Array<{
      id: string;
      editionNumber: string;
      publicationDate: string | null;
    }> = [];
    const unresolved: Array<{ id: string; reason: string }> = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const document of documents) {
      if (!document.pdf_url) {
        unresolved.push({
          id: document.id,
          reason: "Documento sem URL disponível para leitura.",
        });
        continue;
      }

      try {
        const fileBuffer = await downloadPdf(document.pdf_url);
        const metadata =
          await extractOfficialGazetteMetadataFromPdfBuffer(fileBuffer);

        if (!metadata.editionNumber) {
          unresolved.push({
            id: document.id,
            reason: "Número da edição não encontrado no conteúdo do PDF.",
          });
          continue;
        }

        const publicationDate =
          document.publication_date ?? metadata.publicationDate;
        const title = buildDocumentTitle(
          metadata.editionNumber,
          document.title,
        );

        const { error: updateError } = await supabase
          .from("governance_official_gazette_documents")
          .update({
            edition_number: metadata.editionNumber,
            publication_date: publicationDate,
            title,
          })
          .eq("id", document.id)
          .eq("organization_id", context.organization.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        updated.push({
          id: document.id,
          editionNumber: metadata.editionNumber,
          publicationDate,
        });
      } catch (error) {
        failed.push({
          id: document.id,
          error:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao corrigir metadados.",
        });
      }
    }

    return NextResponse.json({
      checked: documents.length,
      updated,
      unresolved,
      failed,
    });
  } catch (error) {
    console.error(
      "[governance] Erro ao corrigir metadados do Diário Oficial:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao corrigir as edições sem número.",
      },
      { status: 500 },
    );
  }
}
