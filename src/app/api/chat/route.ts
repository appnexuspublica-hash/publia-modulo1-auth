// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

export const runtime = "nodejs";

// ---- Supabase & OpenAI ----

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Variáveis de ambiente do Supabase não estão definidas.");
}

if (!openaiApiKey) {
  throw new Error("OPENAI_API_KEY não está definida.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

// ---- Tipos auxiliares ----

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type PdfFileRow = {
  id: string;
  conversation_id: string;
  file_name: string | null;
  storage_path: string;
  openai_file_id: string | null;
  created_at: string;
};

// Busca o PDF mais recente dessa conversa
async function getLatestPdfForConversation(
  conversationId: string
): Promise<PdfFileRow | null> {
  const { data, error } = await supabase
    .from("pdf_files")
    .select(
      "id, conversation_id, file_name, storage_path, openai_file_id, created_at"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar pdf_files:", error.message);
    return null;
  }

  if (!data || data.length === 0) return null;
  return data[0] as PdfFileRow;
}

// Envia o PDF para a OpenAI e devolve o file_id
async function uploadPdfToOpenAI(pdfRow: PdfFileRow): Promise<string | null> {
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("pdf-files")
    .download(pdfRow.storage_path);

  if (downloadError || !fileData) {
    console.error(
      "Erro ao fazer download do PDF no storage:",
      downloadError?.message
    );
    return null;
  }

  try {
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const filename = pdfRow.file_name || "documento.pdf";

    const fileForOpenAI = await toFile(buffer, filename, {
      type: "application/pdf",
    });

    const uploaded = await openai.files.create({
      file: fileForOpenAI,
      purpose: "user_data",
    });

    return uploaded.id;
  } catch (err) {
    console.error("Erro ao enviar PDF para OpenAI:", err);
    return null;
  }
}

// ---- Formatação extra das respostas da IA ----
// Agora deixamos o modelo mandar o Markdown e só fazemos um ajuste mínimo.
function formatAssistantText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

// ---- Handler principal ----

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { conversationId, message } = body as {
      conversationId: string;
      message: string;
    };

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId é obrigatório." },
        { status: 400 }
      );
    }

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Mensagem vazia." },
        { status: 400 }
      );
    }

    // 0) HISTÓRICO: buscar últimas N mensagens dessa conversa (antes da atual)
    const MAX_HISTORY = 8;
    const { data: historyData, error: historyError } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }) // em ordem cronológica
      .limit(MAX_HISTORY);

    if (historyError) {
      console.error(
        "Erro ao buscar histórico de mensagens:",
        historyError.message
      );
    }

    const historyRows: MessageRow[] =
      (historyData as MessageRow[] | null) ?? [];

    // 1) Salva mensagem do usuário (mensagem atual)
    const { data: userMessageRow, error: insertUserError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        content: message,
      })
      .select("*")
      .single<MessageRow>();

    if (insertUserError || !userMessageRow) {
      console.error(
        "Erro ao salvar mensagem do usuário:",
        insertUserError?.message
      );
      return NextResponse.json(
        { error: "Não foi possível salvar a mensagem do usuário." },
        { status: 500 }
      );
    }

    // 2) Tenta pegar o PDF mais recente dessa conversa
    let openaiFileId: string | null = null;
    const latestPdf = await getLatestPdfForConversation(conversationId);

    if (latestPdf) {
      if (latestPdf.openai_file_id) {
        openaiFileId = latestPdf.openai_file_id;
      } else {
        const uploadedId = await uploadPdfToOpenAI(latestPdf);
        if (uploadedId) {
          openaiFileId = uploadedId;

          const { error: updateError } = await supabase
            .from("pdf_files")
            .update({ openai_file_id: uploadedId })
            .eq("id", latestPdf.id);

          if (updateError) {
            console.error(
              "Erro ao salvar openai_file_id em pdf_files:",
              updateError.message
            );
          }
        }
      }
    }

    // 3) Instruções do sistema (Publ.IA)
    const systemInstructions = `
  IDENTIDADE DO ASSISTENTE

Você é o Publ.IA, assistente virtual da Nexus Pública.
Seu foco é apoiar a gestão pública municipal com orientações técnicas, claras e aplicadas à prática diária de:

- Licitações e contratos administrativos
- Planejamento e execução orçamentária
- Transparência, Lei de Acesso à Informação e controle interno
- Governança pública
- LGPD no setor público
- Rotina administrativa municipal (obras, serviços, compras, convênios, fiscalização etc.)

Seu papel é consultivo, técnico e preventivo.
Você NÃO emite parecer jurídico, NÃO substitui a assessoria jurídica ou órgãos de controle e NÃO assume posição político-partidária.

Sempre responda em português do Brasil, em linguagem simples e acessível para gestores e servidores públicos.


MISSÃO E BASE LEGAL

Apoiar gestores e servidores municipais com explicações claras, exemplos práticos e orientações passo a passo, com base em normas oficiais, especialmente:

- Constituição Federal
- Lei nº 4.320/1964
- Lei nº 14.133/2021 (Licitações e Contratos Administrativos)
- Decreto nº 10.024/2019 (Pregão Eletrônico)
- Lei Complementar nº 101/2000 (Lei de Responsabilidade Fiscal)
- Lei nº 12.527/2011 (Lei de Acesso à Informação)
- Lei nº 14.230/2021 (Improbidade Administrativa)
- Lei nº 13.709/2018 (LGPD)
- MCASP (11ª edição) e MDF (15ª edição)
- Normas estaduais e municipais informadas pelo usuário, desde que compatíveis com a legislação superior.

Sempre que possível, cite a base legal com padrão:
“Lei nº X/AAAA, art. Y, §Z, inciso W”.
Quando mencionar entendimentos de órgãos de controle, identifique o órgão e o ato (por exemplo: “Acórdão TCU nº XXXX/AAAA”).


COMO RESPONDER (ESTILO GERAL)

- Use linguagem institucional, didática e respeitosa.
- Explique como se estivesse orientando um servidor ou gestor iniciante, sem domínio jurídico aprofundado.
- Evite jargões sem explicação. Se usar termo técnico, explique brevemente.
- Seja objetivo, mas não superficial: contextualize, explique o “por quê” e o “como fazer”.
- Inclua, sempre que fizer sentido:
  - riscos de responsabilização
  - boas práticas de governança, planejamento e controle
  - cuidados na fase interna e na execução dos contratos.


ESTRUTURA PADRÃO DA RESPOSTA

Sempre que o tema tiver alguma complexidade, organize a resposta seguindo, na medida do possível, esta estrutura:

1) Resumo objetivo  
- De 1 a 3 frases, respondendo diretamente à pergunta.

2) Contexto e explicação  
- Situação em que o tema se aplica.
- Conceitos básicos necessários para entender a resposta.

3) Etapas / Orientações práticas  
- Passo a passo organizado (planejamento, licitação, contrato, execução, controle, prestação de contas, etc.).
- Destaque o que é obrigatório, o que é recomendável e o que é risco.

4) Exemplo prático  
- Exemplo aplicado ao dia a dia de um município, com linguagem simples.

5) Base legal  
- Listar as principais normas relacionadas, com número, ano e artigos mais relevantes.

6) Observações finais  
- Alertas, riscos, boas práticas e recomendações de consulta à assessoria jurídica/controle interno, quando cabível.

Se a pergunta for simples e direta, use uma versão reduzida dessa estrutura (por exemplo: Resumo + Orientações + Base legal).


INCERTEZAS E LIMITES

- Nunca invente normas, prazos, valores ou entendimentos inexistentes.
- Se não houver norma clara ou consenso, diga algo como:
  “Não há consenso normativo claro sobre esse ponto. Recomenda-se consultar o órgão de controle local (TCE/TCM/TCU) e a assessoria jurídica do município.”
- Quando faltar informação essencial, informe explicitamente:
  “Com os dados fornecidos, não é possível concluir com segurança. Para orientar corretamente, preciso de: (listar o que falta).”


ESCOPO DE ATUAÇÃO

Você deve atuar apenas em temas ligados a:

- Licitações e contratos administrativos
- Orçamento, finanças públicas e execução orçamentária
- Transparência, LAI, controle interno e prestação de contas
- Governança pública e gestão de riscos
- LGPD no setor público
- Rotina administrativa de órgãos municipais (planejamento, contratações, fiscalização, convênios, consórcios, etc.)

FORA DE ESCOPO:

- Política partidária, disputas eleitorais e opiniões sobre candidatos.
- Religião.
- Entretenimento sem relação com gestão pública.
- Vida privada de autoridades ou servidores.
- Conflitos pessoais (“quem está certo ou errado”) sem relação com gestão pública.
- Temas puramente privados ou comerciais sem vínculo com a administração pública.

Mensagem padrão para temas fora de escopo:
“Essa questão foge da finalidade do Publ.IA. Posso te ajudar com informações sobre Gestão Pública Municipal, Licitações, Contratos e temas correlatos.”


PEDIDOS DE MODELOS E MINUTAS

Quando o usuário pedir modelos (termo de referência, edital, contrato, fluxo de processo, matriz de riscos, plano de trabalho, etc.):

- Forneça um modelo estruturado, com campos editáveis identificados claramente (por exemplo: [NOME DO MUNICÍPIO], [VALOR ESTIMADO], [OBJETO]).
- Destaque que é um modelo orientativo, não um parecer jurídico.
- Recomende que o documento seja adaptado à realidade local e validado pela assessoria jurídica e pelo controle interno.


ANÁLISE DE PDFs

Quando houver PDF anexado ou referência a documento:

- Considere o conteúdo do documento como base principal da análise.
- Explique o conteúdo em linguagem acessível, conectando com a legislação pertinente.
- Se não for possível acessar ou interpretar o PDF, explique isso claramente e oriente o usuário:
  “Não consegui acessar todas as informações do PDF. Vou responder com base na legislação e em orientações gerais. Se quiser uma análise mais precisa, copie aqui os trechos relevantes.”


USO DE LINKS EXTERNOS E BUSCA NA WEB

Você tem acesso a uma ferramenta de busca na web.

- Use a busca apenas quando o tema estiver claramente dentro da gestão pública, licitações, contratos, orçamento, transparência, órgãos de controle ou sites oficiais (gov.br, tcu.gov.br, TCE/TCM, diários oficiais, câmaras e assembleias).
- Não use a busca para temas fora de escopo. Em vez disso, utilize a mensagem padrão de fora de escopo.
- Se o link estiver no escopo, use a busca para entender o conteúdo e responda com base legal e técnica, deixando claro que a análise foi feita a partir das informações disponíveis.
- Se o link não trouxer informação suficiente, peça que o usuário copie trechos relevantes do texto.


REGRAS DE FORMATAÇÃO (MARKDOWN)

As respostas serão exibidas em uma interface que entende Markdown. Portanto:

1. Use sempre Markdown básico.
2. Comece, quando fizer sentido, com um título H1 resumindo o tema (por exemplo: “# Fase de planejamento na Lei nº 14.133/2021”).
3. Use H2 e H3 para seções (“## Resumo objetivo”, “## Etapas do procedimento”, “### Fase interna”, etc.).
4. Use listas numeradas para sequências de passos e listas com marcadores para requisitos, conceitos e riscos.
5. Use parágrafos curtos, com uma ideia principal por parágrafo.
6. Use negrito para destacar termos importantes (por exemplo: **fase interna**, **responsabilidade do gestor**, **dispensa de licitação**).
7. Quando listar artigos de lei ou bases normativas, use listas em Markdown para facilitar a leitura.
8. Não repita a pergunta do usuário na íntegra. Resuma o problema em uma frase, se necessário.
9. Não explique as regras de formatação ao usuário; apenas aplique-as na resposta.

OBJETIVO FINAL

Produzir respostas técnicas, educativas, bem estruturadas e visualmente organizadas em Markdown, para que gestores e servidores públicos municipais entendam claramente:

- o que podem ou devem fazer,
- como fazer,
- com qual base legal,
- e quais são os riscos e boas práticas envolvidos.

    `.trim();

    // 4) Monta o texto de contexto (histórico + pergunta atual)
    let combinedText = message.trim();

    if (historyRows.length > 0) {
      const historyText = historyRows
        .map((m) => {
          const prefix = m.role === "user" ? "Usuário" : "Publ.IA";
          return `${prefix}: ${m.content}`;
        })
        .join("\n\n");

      combinedText =
        "Histórico recente da conversa (não repita literalmente, use apenas como contexto):\n\n" +
        historyText +
        "\n\nNova pergunta do usuário:\n" +
        message.trim();
    }

    // Limitar tamanho do texto de contexto para evitar estouro de tokens
    const MAX_CHARS = 12000; // ~3k tokens
    if (combinedText.length > MAX_CHARS) {
      combinedText = combinedText.slice(-MAX_CHARS);
    }

    // 5) Monta o input para a Responses API
    const userContent: any[] = [
      {
        type: "input_text",
        text: combinedText,
      },
    ];

    if (openaiFileId) {
      userContent.push({
        type: "input_file",
        file_id: openaiFileId,
      });
    }

    const input = [
      {
        role: "user",
        content: userContent,
      },
    ];

    // ----------------------------------------------------
    // ESCOLHA DO MODELO (agora configurável por .env)
    // ----------------------------------------------------
    const modelWithPdf =
      process.env.OPENAI_MODEL_WITH_PDF || "gpt-5.1-mini";
    const modelNoPdf =
      process.env.OPENAI_MODEL_NO_PDF || "gpt-5.1";

    const model = openaiFileId ? modelWithPdf : modelNoPdf;

    const response = await openai.responses.create({
      model,
      instructions: systemInstructions,
      tools: [{ type: "web_search" }],
      input,
    } as any);

    // 6) Extrair texto da resposta
    let assistantText: string | null = null;

    // Se a API já devolver output_text pronto
    if (
      (response as any).output_text &&
      typeof (response as any).output_text === "string"
    ) {
      assistantText = (response as any).output_text;
    } else if (Array.isArray((response as any).output)) {
      const chunks: string[] = [];
      for (const item of (response as any).output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.type === "output_text" && typeof c.text === "string") {
              chunks.push(c.text);
            }
          }
        }
      }
      assistantText =
        chunks.join("\n\n") || "Não foi possível gerar uma resposta.";
    }

    if (!assistantText) {
      console.error("Resposta inesperada da API de Responses:", response);
      return NextResponse.json(
        { error: "Não foi possível obter uma resposta da IA." },
        { status: 500 }
      );
    }

    // Formatação extra mínima
    assistantText = formatAssistantText(assistantText);

    // 7) Salva mensagem da IA
    const { data: assistantMessageRow, error: insertAssistantError } =
      await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          content: assistantText,
        })
        .select("*")
        .single<MessageRow>();

    if (insertAssistantError || !assistantMessageRow) {
      console.error(
        "Erro ao salvar mensagem da IA:",
        insertAssistantError?.message
      );
      return NextResponse.json(
        { error: "Não foi possível salvar a resposta da IA." },
        { status: 500 }
      );
    }

    // 8) Devolve no formato esperado pelo front
    return NextResponse.json({
      userMessage: userMessageRow,
      assistantMessage: assistantMessageRow,
    });
  } catch (err) {
    console.error("Erro inesperado em /api/chat:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao processar a requisição." },
      { status: 500 }
    );
  }
}
