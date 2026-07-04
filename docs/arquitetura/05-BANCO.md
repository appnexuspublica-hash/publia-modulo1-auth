# 05 — Mapa Inicial do Banco Supabase

Tabelas e RPCs identificadas por chamadas `.from(...)` e `.rpc(...)`.

| Tabela/RPC | Domínios que citam | Nº arquivos | Arquivos |
|---|---|---:|---|
| `check_rate_limit` | Autenticação/Core | 3 | `src/app/(auth)/criar-conta/formActions.ts`, `src/app/api/recuperar-senha/route.ts`, `src/app/api/signup-token/route.ts` |
| `cleanup_signup_tokens` | Autenticação/Core | 2 | `src/app/(auth)/criar-conta/formActions.ts`, `src/app/api/signup-token/route.ts` |
| `conversation_pdf_links` | Core compartilhado, Essencial/Estratégico | 5 | `src/app/api/pdf/detach/route.ts`, `src/app/api/upload-pdf/route.ts`, `src/app/api/upload-pdf/route.ts.bak`, `src/app/api/upload-pdf/upload-pdf-route - Copia.ts`, `src/app/chat/ChatPageClient.tsx` |
| `conversations` | Core compartilhado, Essencial/Estratégico | 8 | `src/app/api/access/me/route.ts`, `src/app/api/chat/route.ts`, `src/app/api/pdf/detach/route.ts`, `src/app/api/public/share/[shareId]/route.ts`, `src/app/api/upload-pdf/route.ts`, `src/app/api/upload-pdf/route.ts.bak` ... |
| `create_governance_conversation` | Governança | 2 | `src/app/api/governance/conversations/conversations-route.ts`, `src/app/api/governance/conversations/route.ts` |
| `governance_conversations` | Core compartilhado, Governança | 13 | `src/app/api/governance/chat/route.ts`, `src/app/api/governance/conversations/[conversationId]/route.ts`, `src/app/api/governance/conversations/conversations-route.ts`, `src/app/api/governance/conversations/route.ts`, `src/app/api/governance/messages/route.ts`, `src/app/api/public/share/[shareId]/route.ts` ... |
| `governance_messages` | Governança | 7 | `src/app/api/governance/chat/route.ts`, `src/app/api/governance/messages/route.ts`, `src/app/governanca/chat/GovernanceChatClient.tsx`, `src/app/governanca/chat/page.tsx`, `src/app/governanca/conversas/[conversationId]/page.tsx`, `src/app/governanca/conversas/page.tsx` ... |
| `governance_official_gazette_chunks` | Governança | 3 | `src/app/api/governance/chat/route.ts`, `src/app/api/governance/official-gazette-chunks/route.ts`, `src/app/api/governance/official-gazette-documents/route.ts` |
| `governance_official_gazette_documents` | Governança | 1 | `src/app/api/governance/official-gazette-documents/route.ts` |
| `governance_official_gazettes` | Governança | 2 | `src/app/api/governance/official-gazette-documents/route.ts`, `src/app/api/governance/official-gazette/route.ts` |
| `institutional_documents` | Governança | 4 | `src/app/api/governance/chat/route.ts`, `src/app/api/governance/institutional-documents/route.backup-v8-5.ts`, `src/app/api/governance/institutional-documents/route.ts`, `src/app/governanca/base-institucional/page.tsx` |
| `kiwify_webhook_logs` | Essencial/Estratégico | 1 | `src/app/api/kiwify/webhook/route.ts` |
| `match_pdf_chunks` | Core compartilhado, Governança | 2 | `src/app/api/governance/chat/route.ts`, `src/lib/pdf/retrieveChunks.ts` |
| `messages` | Essencial/Estratégico | 3 | `src/app/api/access/me/route.ts`, `src/app/api/chat/route.ts`, `src/app/chat/ChatPageClient.tsx` |
| `official_sources` | Governança | 2 | `src/app/api/governance/chat/route.ts`, `src/app/api/governance/official-sources/route.ts` |
| `organization_audit_logs` | Admin/Core, Governança | 3 | `src/app/api/governance/audit-logs/route.ts`, `src/app/api/governance/users/route.ts`, `src/app/api/nexus-admin/organizations/route.ts` |
| `organization_members` | Admin/Core, Governança | 5 | `src/app/api/governance/auth/login/route.ts`, `src/app/api/governance/users/route.ts`, `src/app/api/nexus-admin/organizations/route.ts`, `src/app/governanca/usuarios/page.tsx`, `src/lib/governance/get-current-organization.ts` |
| `organizations` | Admin/Core, Governança | 2 | `src/app/api/governance/auth/login/route.ts`, `src/app/api/nexus-admin/organizations/route.ts` |
| `pdf-files` | Essencial/Estratégico | 1 | `src/app/chat/ChatPageClient.tsx` |
| `pdf_chunks` | Core compartilhado | 2 | `src/lib/pdf/processForIndexing.ts`, `src/lib/pdf/processForIndexing.ts.bak` |
| `pdf_files` | Core compartilhado, Essencial/Estratégico, Governança | 11 | `src/app/api/access/me/route.ts`, `src/app/api/chat/route.ts`, `src/app/api/governance/chat/route.ts`, `src/app/api/pdf/ask/route.ts`, `src/app/api/pdf/index/route.ts`, `src/app/api/upload-pdf/route.ts` ... |
| `profiles` | Admin/Core, Autenticação/Core, Essencial/Estratégico, Governança | 22 | `src/app/(auth)/criar-conta/formActions.ts`, `src/app/(auth)/login/loginActions.ts`, `src/app/(auth)/recuperar-senha/resetActions.ts`, `src/app/api/access/me/route.ts`, `src/app/api/admin/reset-user-password/route.ts`, `src/app/api/governance/auth/login/route.ts` ... |
| `signup_tokens` | Autenticação/Core, Essencial/Estratégico | 6 | `src/app/(auth)/criar-conta/formActions.ts`, `src/app/api/access/start-strategic-trial/route.ts`, `src/app/api/kiwify/webhook/route.ts`, `src/app/api/signup-token/route.ts`, `src/lib/access/applySignupTokenAccess.ts`, `src/lib/access/reconcileUserAccessSnapshot.ts` |
| `usage_events` | Core compartilhado, Core/Indefinido, Essencial/Estratégico | 6 | `src/app/api/export-xlsx/route.ts`, `src/app/api/public/share/create/route.ts`, `src/app/api/upload-pdf/route.ts`, `src/app/api/upload-pdf/route.ts.bak`, `src/app/api/upload-pdf/upload-pdf-route - Copia.ts`, `src/lib/access-control.ts` |
| `user_access` | Essencial/Estratégico | 8 | `src/app/api/admin/audit-access/fix/route.ts`, `src/app/api/admin/audit-access/inconsistencies/route.ts`, `src/app/api/admin/audit-access/route.ts`, `src/app/api/kiwify/webhook/route.ts`, `src/lib/access-control.ts`, `src/lib/access/applySignupTokenAccess.ts` ... |
| `user_access_grants` | Essencial/Estratégico | 7 | `src/app/api/admin/audit-access/fix/route.ts`, `src/app/api/admin/audit-access/inconsistencies/route.ts`, `src/app/api/admin/audit-access/route.ts`, `src/app/api/kiwify/webhook/route.ts`, `src/lib/access/applySignupTokenAccess.ts`, `src/lib/access/getCurrentUserAccess.ts` ... |
| `user_access_summary` | Essencial/Estratégico | 1 | `src/lib/access-control.ts` |

## Atenção

A tabela `pdf_files` aparece no fluxo compartilhado de PDFs. Já as tabelas com prefixo `governance_` e `institutional_documents` pertencem ao domínio da Governança.
