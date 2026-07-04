# 01 — Inventário Arquitetural do Publ.IA

Gerado a partir do ZIP atual do projeto. Este documento não altera o sistema; apenas registra o que existe no código.

## 1. Visão geral identificada

| Camada | Evidência no código | Observação |
|---|---|---|
| Core compartilhado | `src/lib`, `src/app/api/pdf`, `src/app/api/upload-pdf`, `src/lib/supabase` | Serviços usados por mais de um produto. Alto cuidado. |
| Essencial/Estratégico | `src/app/chat`, `src/app/api/chat`, `src/app/api/access`, `src/lib/access*` | Chat principal, planos, trial e controle de acesso. |
| Governança | `src/app/governanca`, `src/app/api/governance`, `src/lib/governance` | Fluxo mais isolado, mas ainda toca PDF compartilhado. |
| Autenticação/Admin | `src/app/(auth)`, `src/app/api/admin`, `src/app/api/nexus-admin` | Login, cadastro, recuperação e administração. |

## 2. Quantitativo

| Item | Total |
|---|---:|
| Arquivos no ZIP | 144 |
| Rotas API `app/api/**/route.ts` | 33 |
| Páginas `page.tsx/page.ts` | 22 |
| Componentes `.tsx` fora de `page/layout` | 41 |
| Arquivos em `src/lib` | 30 |
| Arquivos em `src/types` | 2 |

## 3. Diretórios principais

```text
src/
├── app/
├── components/
├── lib/
├── types/
└── middleware.ts
```

## 4. Páginas identificadas

- `src/app/(auth)/criar-conta/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/recuperar-senha/page.tsx`
- `src/app/atualizar-senha/page.tsx`
- `src/app/chat/page.tsx`
- `src/app/governanca/auditoria/page.tsx`
- `src/app/governanca/base-institucional/page.tsx`
- `src/app/governanca/chat/page.tsx`
- `src/app/governanca/conversas/[conversationId]/page.tsx`
- `src/app/governanca/conversas/page.tsx`
- `src/app/governanca/diario-oficial/page.tsx`
- `src/app/governanca/fontes-oficiais/page.tsx`
- `src/app/governanca/indicadores/page.tsx`
- `src/app/governanca/login/page.tsx`
- `src/app/governanca/page.tsx`
- `src/app/governanca/share/[shareId]/page.tsx`
- `src/app/governanca/usuarios/page.tsx`
- `src/app/nexus-admin/organizacoes/page.tsx`
- `src/app/nexus-admin/page.tsx`
- `src/app/p/[shareId]/page.tsx`
- `src/app/pagamento/retorno/page.tsx`
- `src/app/page.tsx`

## 5. Bibliotecas identificadas

- `src/lib/access-client.ts`
- `src/lib/access-control.ts`
- `src/lib/access-cta.ts`
- `src/lib/access/access-helpers.ts`
- `src/lib/access/applySignupTokenAccess.ts`
- `src/lib/access/getCurrentUserAccess.ts`
- `src/lib/access/products/product-mode.ts`
- `src/lib/access/reconcileUserAccessSnapshot.ts`
- `src/lib/access/resolveUserAccess.ts`
- `src/lib/copy/copyMessageToClipboard.ts`
- `src/lib/external/supabase.ts`
- `src/lib/governance/get-current-organization.ts`
- `src/lib/governanceCriticalKnowledge.ts`
- `src/lib/governanceLegalGuardrails.ts`
- `src/lib/hooks/useStickToBottom.ts`
- `src/lib/pdf/chunking.ts`
- `src/lib/pdf/extract.ts`
- `src/lib/pdf/officialGazetteActNormalizer.ts`
- `src/lib/pdf/processForIndexing.ts`
- `src/lib/pdf/processForIndexing.ts.bak`
- `src/lib/pdf/retrieveChunks.ts`
- `src/lib/publiaPrompt.ts`
- `src/lib/supabase-browser.ts`
- `src/lib/supabase-server.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/index.ts`
- `src/lib/supabase/server.ts`
- `src/lib/validators.ts`
- `src/lib/webFirstDetector.ts`
