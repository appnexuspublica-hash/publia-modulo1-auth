# 06 — Variáveis de Ambiente Identificadas

Extraídas de `process.env.*`.

| Variável | Arquivos que usam |
|---|---|
| `ADMIN_INTERNAL_API_KEY` | `src/app/api/admin/reset-user-password/route.ts` |
| `GOVERNANCE_PDF_INDEX_MAX_MB` | `src/app/api/pdf/index/route.ts` |
| `KIWIFY_WEBHOOK_SECRET` | `src/app/api/kiwify/webhook/route.ts` |
| `NEXT_PUBLIC_AFTER_SIGNUP_LOGIN` | `src/app/(auth)/criar-conta/formActions.ts` |
| `NEXT_PUBLIC_SITE_URL` | `src/app/logout/route.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/app/api/access/me/route.ts`, `src/app/api/admin/reset-user-password/route.ts`, `src/app/api/chat/route.ts`, `src/app/api/governance/audit-logs/route.ts`, `src/app/api/governance/chat/route.ts`, `src/app/api/governance/conversations/[conversationId]/route.ts`, `src/app/api/governance/conversations/conversations-route.ts`, `src/app/api/governance/conversations/route.ts` ... |
| `NEXT_PUBLIC_SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET` | `src/app/api/governance/institutional-documents/route.backup-v8-5.ts`, `src/app/api/governance/institutional-documents/route.ts`, `src/app/api/governance/official-gazette-documents/route.ts`, `src/app/api/upload-pdf/route.ts`, `src/app/api/upload-pdf/route.ts.bak`, `src/app/api/upload-pdf/upload-pdf-route - Copia.ts`, `src/app/governanca/chat/GovernanceChatClient.tsx`, `src/lib/pdf/processForIndexing.ts` ... |
| `NEXT_PUBLIC_SUPABASE_PDF_BUCKET` | `src/app/api/upload-pdf/route.ts`, `src/app/api/upload-pdf/route.ts.bak`, `src/app/api/upload-pdf/upload-pdf-route - Copia.ts`, `src/app/governanca/chat/GovernanceChatClient.tsx`, `src/lib/pdf/processForIndexing.ts`, `src/lib/pdf/processForIndexing.ts.bak` |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/app/(auth)/criar-conta/formActions.ts`, `src/app/(auth)/recuperar-senha/resetActions.ts`, `src/app/api/access/apply-token/route.ts`, `src/app/api/access/me/route.ts`, `src/app/api/access/start-strategic-trial/route.ts`, `src/app/api/admin/reset-user-password/route.ts`, `src/app/api/chat/route.ts`, `src/app/api/governance/audit-logs/route.ts` ... |
| `NEXUS_ADMIN_PASSWORD` | `src/app/api/nexus-admin/organizations/route.ts` |
| `NEXUS_ADMIN_USER` | `src/app/api/nexus-admin/organizations/route.ts` |
| `NODE_ENV` | `src/app/api/pdf/index/route.ts`, `src/app/api/pdf/reprocess/route.ts`, `src/lib/supabase/server.ts` |
| `OPENAI_API_KEY` | `src/app/api/chat/route.ts`, `src/app/api/governance/chat/route.ts`, `src/app/api/pdf/ask/route.ts`, `src/lib/pdf/extract.ts`, `src/lib/pdf/processForIndexing.ts`, `src/lib/pdf/processForIndexing.ts.bak`, `src/lib/pdf/retrieveChunks.ts` |
| `OPENAI_CHAT_MODEL` | `src/app/api/pdf/ask/route.ts` |
| `OPENAI_EMBEDDING_MODEL` | `src/app/api/governance/chat/route.ts`, `src/lib/pdf/processForIndexing.ts`, `src/lib/pdf/processForIndexing.ts.bak`, `src/lib/pdf/retrieveChunks.ts` |
| `OPENAI_MODEL` | `src/app/api/chat/route.ts` |
| `OPENAI_MODEL_GOVERNANCE` | `src/app/api/governance/chat/route.ts` |
| `OPENAI_MODEL_NO_PDF` | `src/app/api/chat/route.ts`, `src/app/api/governance/chat/route.ts` |
| `OPENAI_OCR_MODEL` | `src/lib/pdf/extract.ts` |
| `OPENAI_PDF_OCR_MODEL` | `src/lib/pdf/extract.ts` |
| `PDF_EXTRACT_MAX_MB` | `src/app/api/governance/institutional-documents/route.backup-v8-5.ts`, `src/app/api/governance/institutional-documents/route.ts`, `src/app/api/governance/official-gazette-documents/route.ts`, `src/lib/pdf/processForIndexing.ts`, `src/lib/pdf/processForIndexing.ts.bak` |
| `PDF_INDIVIDUAL_PREFER_OCR` | `src/lib/pdf/processForIndexing.ts` |
| `PDF_OCR_ENABLED` | `src/lib/pdf/extract.ts` |
| `PDF_OCR_MAX_MB` | `src/lib/pdf/extract.ts` |
| `PDF_OCR_MIN_TEXT_LENGTH` | `src/lib/pdf/extract.ts` |
| `RAG_TOP_K` | `src/app/api/governance/chat/route.ts` |
| `SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET` | `src/app/api/governance/institutional-documents/route.backup-v8-5.ts`, `src/app/api/governance/institutional-documents/route.ts`, `src/app/api/governance/official-gazette-documents/route.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/app/(auth)/criar-conta/formActions.ts`, `src/app/(auth)/recuperar-senha/resetActions.ts`, `src/app/api/access/apply-token/route.ts`, `src/app/api/access/start-strategic-trial/route.ts`, `src/app/api/governance/conversations/[conversationId]/route.ts`, `src/app/api/governance/users/route.ts`, `src/app/api/public/share/[shareId]/route.ts`, `src/app/api/signup-token/route.ts` ... |

## Lembrete

Não versionar `.env.local`. Na Vercel, configurar as mesmas variáveis usadas localmente em Production.
