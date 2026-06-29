// src/app/api/governance/official-gazette-chunks/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";
import { normalizeOfficialGazetteActs } from "@/lib/pdf/officialGazetteActNormalizer";

export const dynamic = "force-dynamic";

const CHUNK_SELECT = `
  document_id,
  organization_id,
  page_number,
  section_type,
  title,
  content
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

function parseDocumentIds(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((documentId) => documentId.trim())
    .filter(Boolean);
}
type GazetteChunkRow = {
  document_id: string;
  organization_id: string;
  page_number: number | null;
  section_type: string | null;
  title: string | null;
  content: string | null;
};

type GazetteChunkDraft = {
  page_number: number | null;
  section_type: string;
  title: string;
  content: string;
};

const MAX_CHUNK_CONTENT_LENGTH = 12_000;

function normalizeGazetteText(raw: string) {
  return String(raw ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/D4Sign\s+[^\n]+/gi, "\n")
    .replace(/Documento assinado eletronicamente[^\n]*/gi, "\n")
    .replace(/Para confirmar as assinaturas acesse[^\n]*/gi, "\n")
    .replace(/Código do documento[^\n]*/gi, "\n")
    .replace(/Certificado de assinaturas[^\n]*/gi, "\n")
    .replace(/Datas e horários baseados[^\n]*/gi, "\n")
    .replace(/Sincronizado com o NTP\.br[^\n]*/gi, "\n")
    .replace(/Observatório Nacional[^\n]*/gi, "\n")
    .replace(/Em conformidade com a Lei Municipal[^\n]*/gi, "\n")
    .replace(/Prefeitura Municipal de[^\n]*/gi, "\n")
    .replace(/Praça Frei Mathias[^\n]*/gi, "\n")
    .replace(/Fone\/Fax:[^\n]*/gi, "\n")
    .replace(/Site Oficial do Município:[^\n]*/gi, "\n")
    .replace(/A Prefeitura Municipal de Santana do Itararé,[\s\S]*?diariooficial\//gi, "\n")
    .replace(/ANO:\s*\d{4}\s*\|\s*EDIÇÃO\s*N[°º]\s*\d+\s*\|[^\n]+PÁGINA:\s*\d+/gi, "\n")
    .replace(/\b\d+\s*páginas?\b/gi, "\n")
    .replace(/\b\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}\b/gi, "\n")
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

function normalizeActTitle(title: string) {
  return title.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim().slice(0, 220);
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

function expandChunkRowsForDisplay(rows: GazetteChunkRow[]) {
  return rows.flatMap((row) => {
    const originalContent = String(row.content ?? "").trim();
    const splitActs = splitOfficialGazetteActs(originalContent);

    if (splitActs.length <= 1) {
      const onlyAct = splitActs[0];

      if (!onlyAct) {
        return [row];
      }

      return [
        {
          ...row,
          section_type: row.section_type || onlyAct.section_type,
          title: row.title || onlyAct.title,
          content: originalContent || onlyAct.content,
        },
      ];
    }

    return splitActs.map((act) => ({
      ...row,
      page_number: act.page_number ?? row.page_number,
      section_type: act.section_type,
      title: act.title,
      content: act.content,
    }));
  });
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
    const documentId = searchParams.get("documentId");
    const documentIds = parseDocumentIds(searchParams.get("documentIds"));

    let query = supabase
      .from("governance_official_gazette_chunks")
      .select(CHUNK_SELECT)
      .eq("organization_id", context.organization.id)
      .order("document_id", { ascending: true })
      .order("page_number", { ascending: true, nullsFirst: false })
      .order("title", { ascending: true, nullsFirst: false });

    if (documentIds.length > 0) {
      query = query.in("document_id", documentIds);
    } else if (documentId) {
      query = query.eq("document_id", documentId);
    } else {
      return NextResponse.json(
        { error: "Informe a edição do Diário Oficial." },
        { status: 400 },
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("[governance] Erro ao listar atos do Diário Oficial:", error);

      return NextResponse.json(
        { error: "Não foi possível listar os atos do Diário Oficial." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      chunks: expandChunkRowsForDisplay((data ?? []) as GazetteChunkRow[]),
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao listar atos do Diário Oficial:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao listar os atos do Diário Oficial." },
      { status: 500 },
    );
  }
}
