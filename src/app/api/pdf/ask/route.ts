import OpenAI from "openai";
import { NextResponse } from "next/server";

import { buildPdfContext, retrieveRelevantPdfChunks } from "@/lib/pdf/retrieveChunks";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";

let openai: OpenAI | null = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function jsonError(message: string, status = 400, detail?: string) {
  return NextResponse.json(
    {
      error: message,
      ...(detail ? { detail } : {}),
    },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    if (!openai) {
      return jsonError("OPENAI_API_KEY ausente.", 500);
    }

    const body = await req.json();

    const pdfFileId = String(body?.pdfFileId ?? "").trim();
    const question = String(body?.question ?? "").trim();

    if (!pdfFileId) {
      return jsonError("pdfFileId é obrigatório.", 400);
    }

    if (!question) {
      return jsonError("question é obrigatória.", 400);
    }

    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    console.log("[pdf/ask] user.id:", user?.id);
    console.log("[pdf/ask] pdfFileId:", pdfFileId);

    if (userErr || !user) {
      console.error("[pdf/ask] auth error:", userErr?.message);
      return jsonError("Não autenticado.", 401, userErr?.message);
    }

    const { data: pdf, error: pdfErr } = await supabase
      .from("pdf_files")
      .select("id, user_id, file_name, extracted_text_status, vector_index_status")
      .eq("id", pdfFileId)
      .eq("user_id", user.id)
      .maybeSingle();

    console.log("[pdf/ask] pdf:", pdf);
    console.log("[pdf/ask] pdfErr:", pdfErr);

    if (pdfErr) {
      return jsonError("Falha ao buscar pdf_files.", 500, pdfErr.message);
    }

    if (!pdf) {
      return jsonError("PDF não encontrado.", 404);
    }

    const extractedStatus = String((pdf as any).extracted_text_status ?? "").toLowerCase();
    const vectorStatus = String((pdf as any).vector_index_status ?? "").toLowerCase();

    if (extractedStatus !== "ready" || vectorStatus !== "ready") {
      return NextResponse.json(
        {
          ok: false,
          error: "PDF ainda não está pronto para perguntas.",
          extracted_text_status: extractedStatus,
          vector_index_status: vectorStatus,
        },
        { status: 409 }
      );
    }

    const chunks = await retrieveRelevantPdfChunks({
      client: supabase,
      userId: user.id,
      pdfFileId,
      question,
      matchCount: 6,
      minSimilarity: 0.1,
    });

    console.log("[pdf/ask] chunks encontrados:", chunks.length);
    console.log("[pdf/ask] chunks:", chunks);

    if (!chunks.length) {
      return NextResponse.json({
        ok: true,
        answer:
          "Não encontrei trechos suficientemente relevantes neste PDF para responder com segurança.",
        citations: [],
        chunksFound: 0,
      });
    }

    const context = buildPdfContext(chunks);

    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Você é o assistente do Publ.IA. Responda apenas com base nos trechos recuperados do PDF. Se a informação não estiver claramente presente no contexto, diga isso de forma objetiva. Não invente conteúdo. Responda em português do Brasil.",
        },
        {
          role: "user",
          content: [
            `Arquivo: ${String((pdf as any).file_name ?? "PDF")}`,
            "",
            "Trechos recuperados do PDF:",
            context,
            "",
            `Pergunta do usuário: ${question}`,
            "",
            "Regras:",
            "- Use apenas o contexto enviado.",
            "- Se faltar informação, diga que não encontrou no PDF.",
            "- Quando possível, mencione os trechos usados.",
          ].join("\n"),
        },
      ],
    });

    const answer =
      response.choices?.[0]?.message?.content?.trim() ||
      "Não foi possível gerar uma resposta com base no PDF.";

    return NextResponse.json({
      ok: true,
      answer,
      citations: chunks.map((chunk) => ({
        chunk_index: chunk.chunk_index,
        similarity: chunk.similarity,
        preview: chunk.content.slice(0, 220),
      })),
      chunksFound: chunks.length,
      model: CHAT_MODEL,
    });
  } catch (error: any) {
    console.error("[pdf/ask] erro geral:", error);

    return jsonError(
      "Falha ao responder pergunta sobre o PDF.",
      500,
      String(error?.message ?? error ?? "Erro desconhecido")
    );
  }
}