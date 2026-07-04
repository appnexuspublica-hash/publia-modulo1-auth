# 04 — Compartilhamento e Pontos de Acoplamento

## Arquivos classificados como Core compartilhado / alto risco

- `src/app/api/pdf/ask/route.ts`
- `src/app/api/pdf/detach/route.ts`
- `src/app/api/pdf/index/route.ts`
- `src/app/api/pdf/reprocess/route.ts`
- `src/app/api/public/share/[shareId]/route.ts`
- `src/app/api/public/share/create/route.ts`
- `src/app/api/upload-pdf/route.ts`
- `src/app/api/upload-pdf/upload-pdf-route - Copia.ts`
- `src/lib/pdf/chunking.ts`
- `src/lib/pdf/extract.ts`
- `src/lib/pdf/officialGazetteActNormalizer.ts`
- `src/lib/pdf/processForIndexing.ts`
- `src/lib/pdf/retrieveChunks.ts`
- `src/lib/supabase-browser.ts`
- `src/lib/supabase-server.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/index.ts`
- `src/lib/supabase/server.ts`

## Principais acoplamentos já confirmados

| Ponto | Motivo do risco | Ação recomendada |
|---|---|---|
| `src/app/api/upload-pdf/route.ts` | Entrada de PDF usada por mais de um produto | Não colocar regra exclusiva de plano/governança diretamente sem chave de produto clara. |
| `src/app/api/pdf/index/route.ts` | Indexação/extração de PDF; toca storage, tabelas e limites | Tratar regras de negócio fora do Core ou por adaptadores. |
| `src/app/api/pdf/ask/route.ts` | Perguntas com PDF; pode misturar contexto de chat principal e Governança | Antes de alterar, mapear quem chama no frontend. |
| `src/lib/pdf/*` | Motor de PDF compartilhado | Deve permanecer genérico, sem conhecer produto. |
| `src/lib/publiaPrompt.ts` | Prompt potencialmente comum | Evitar misturar prompt de Governança com Essencial/Estratégico. |
