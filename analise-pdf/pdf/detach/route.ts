// src/app/api/pdf/detach/route.ts
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DetachPdfRequestBody = {
  conversationId?: string;
  pdfFileId?: string;
};

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type deve ser application/json." },
        { status: 415 }
      );
    }

    const client = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const userId = user.id;

    const body = (await req.json().catch(() => null)) as DetachPdfRequestBody | null;
    const conversationId = String(body?.conversationId ?? "").trim();
    const requestedPdfFileId = String(body?.pdfFileId ?? "").trim();

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId é obrigatório." },
        { status: 400 }
      );
    }

    if (!uuidRe.test(conversationId)) {
      return NextResponse.json(
        { error: "conversationId inválido." },
        { status: 400 }
      );
    }

    if (requestedPdfFileId && !uuidRe.test(requestedPdfFileId)) {
      return NextResponse.json(
        { error: "pdfFileId inválido." },
        { status: 400 }
      );
    }

    const { data: conversation, error: conversationError } = await client
      .from("conversations")
      .select("id, active_pdf_file_id, pdf_enabled")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (conversationError) {
      console.error("[/api/pdf/detach] erro ao validar conversa:", conversationError);

      return NextResponse.json(
        {
          error: "Falha ao validar a conversa para desanexar PDF.",
          detail: conversationError.message,
        },
        { status: 500 }
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa inválida para desanexar PDF." },
        { status: 404 }
      );
    }

    let targetPdfFileId = requestedPdfFileId;

    if (!targetPdfFileId) {
      const activePdfFileId = String((conversation as any)?.active_pdf_file_id ?? "").trim();

      if (activePdfFileId) {
        targetPdfFileId = activePdfFileId;
      } else {
        const { data: fallbackLink, error: fallbackError } = await client
          .from("conversation_pdf_links")
          .select("pdf_file_id, created_at")
          .eq("conversation_id", conversationId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackError) {
          console.error("[/api/pdf/detach] erro ao localizar PDF fallback:", fallbackError);

          return NextResponse.json(
            {
              error: "Falha ao localizar PDF para desanexar.",
              detail: fallbackError.message,
            },
            { status: 500 }
          );
        }

        targetPdfFileId = String((fallbackLink as any)?.pdf_file_id ?? "").trim();
      }
    }

    if (!targetPdfFileId) {
      const { error: conversationUpdateError } = await client
        .from("conversations")
        .update({ active_pdf_file_id: null, pdf_enabled: false } as any)
        .eq("id", conversationId)
        .eq("user_id", userId);

      if (conversationUpdateError) {
        console.error(
          "[/api/pdf/detach] erro ao limpar conversa sem PDFs:",
          conversationUpdateError
        );

        return NextResponse.json(
          {
            error: "Falha ao atualizar a conversa sem PDFs.",
            detail: conversationUpdateError.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        removedPdfFileId: null,
        activePdfFileId: null,
        pdfEnabled: false,
      });
    }

    const { data: targetLink, error: targetLinkError } = await client
      .from("conversation_pdf_links")
      .select("id, pdf_file_id, is_active")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .eq("pdf_file_id", targetPdfFileId)
      .maybeSingle();

    if (targetLinkError) {
      console.error("[/api/pdf/detach] erro ao validar vínculo do PDF:", targetLinkError);

      return NextResponse.json(
        {
          error: "Falha ao validar o vínculo do PDF com a conversa.",
          detail: targetLinkError.message,
        },
        { status: 500 }
      );
    }

    if (!targetLink) {
      return NextResponse.json(
        { error: "O PDF informado não está vinculado a esta conversa." },
        { status: 404 }
      );
    }

    const { error: deleteLinkError } = await client
      .from("conversation_pdf_links")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .eq("pdf_file_id", targetPdfFileId);

    if (deleteLinkError) {
      console.error("[/api/pdf/detach] erro ao remover vínculo do PDF:", deleteLinkError);

      return NextResponse.json(
        {
          error: "Falha ao desanexar PDF da conversa.",
          detail: deleteLinkError.message,
        },
        { status: 500 }
      );
    }

    const { data: remainingLinks, error: remainingLinksError } = await client
      .from("conversation_pdf_links")
      .select("pdf_file_id, created_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (remainingLinksError) {
      console.error("[/api/pdf/detach] erro ao buscar vínculos restantes:", remainingLinksError);

      return NextResponse.json(
        {
          error: "Falha ao atualizar o estado dos PDFs da conversa.",
          detail: remainingLinksError.message,
        },
        { status: 500 }
      );
    }

    const remainingPdfIds = (remainingLinks ?? [])
      .map((item: any) => String(item?.pdf_file_id ?? "").trim())
      .filter(Boolean);

    const nextActivePdfFileId =
      remainingPdfIds.length > 0 ? remainingPdfIds[remainingPdfIds.length - 1] : null;

    const { error: deactivateAllError } = await client
      .from("conversation_pdf_links")
      .update({ is_active: false } as any)
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);

    if (deactivateAllError) {
      console.error("[/api/pdf/detach] erro ao resetar vínculos ativos:", deactivateAllError);

      return NextResponse.json(
        {
          error: "Falha ao atualizar o PDF ativo da conversa.",
          detail: deactivateAllError.message,
        },
        { status: 500 }
      );
    }

    if (nextActivePdfFileId) {
      const { error: activateNextError } = await client
        .from("conversation_pdf_links")
        .update({ is_active: true } as any)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .eq("pdf_file_id", nextActivePdfFileId);

      if (activateNextError) {
        console.error("[/api/pdf/detach] erro ao ativar próximo PDF:", activateNextError);

        return NextResponse.json(
          {
            error: "Falha ao definir o próximo PDF ativo.",
            detail: activateNextError.message,
          },
          { status: 500 }
        );
      }
    }

    const { error: conversationUpdateError } = await client
      .from("conversations")
      .update({
        active_pdf_file_id: nextActivePdfFileId,
        pdf_enabled: !!nextActivePdfFileId,
      } as any)
      .eq("id", conversationId)
      .eq("user_id", userId);

    if (conversationUpdateError) {
      console.error("[/api/pdf/detach] erro ao atualizar conversa:", conversationUpdateError);

      return NextResponse.json(
        {
          error: "Falha ao atualizar a conversa após desanexar PDF.",
          detail: conversationUpdateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      removedPdfFileId: targetPdfFileId,
      activePdfFileId: nextActivePdfFileId,
      pdfEnabled: !!nextActivePdfFileId,
    });
  } catch (error: any) {
    console.error("[/api/pdf/detach] erro inesperado:", error);

    return NextResponse.json(
      {
        error: "Erro inesperado ao desanexar PDF.",
        detail: String(error?.message ?? error ?? "Erro desconhecido"),
      },
      { status: 500 }
    );
  }
}