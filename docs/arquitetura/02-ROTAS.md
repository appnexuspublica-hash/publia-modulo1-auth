# 02 — Mapa de Rotas API

Tabela extraída de `src/app/api/**/route.ts`.

| Rota | Arquivo | Domínio provável | Risco | Tabelas/RPCs citadas | Variáveis de ambiente |
|---|---|---|---|---|---|
| `/api/access/apply-token` | `src/app/api/access/apply-token/route.ts` | Essencial/Estratégico | MÉDIO | - | NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `/api/access/me` | `src/app/api/access/me/route.ts` | Essencial/Estratégico | MÉDIO | conversations, messages, pdf_files, profiles | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL |
| `/api/access/start-strategic-trial` | `src/app/api/access/start-strategic-trial/route.ts` | Essencial/Estratégico | MÉDIO | signup_tokens | NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `/api/admin/audit-access/fix` | `src/app/api/admin/audit-access/fix/route.ts` | Essencial/Estratégico | MÉDIO | user_access, user_access_grants | - |
| `/api/admin/audit-access/inconsistencies` | `src/app/api/admin/audit-access/inconsistencies/route.ts` | Essencial/Estratégico | MÉDIO | user_access, user_access_grants | - |
| `/api/admin/audit-access` | `src/app/api/admin/audit-access/route.ts` | Essencial/Estratégico | MÉDIO | user_access, user_access_grants | - |
| `/api/admin/reset-user-password` | `src/app/api/admin/reset-user-password/route.ts` | Admin/Core | MÉDIO | profiles | ADMIN_INTERNAL_API_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL |
| `/api/chat` | `src/app/api/chat/route.ts` | Essencial/Estratégico | MÉDIO | conversations, messages, pdf_files | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, OPENAI_API_KEY, OPENAI_MODEL, OPENAI_MODEL_NO_PDF |
| `/api/export-xlsx` | `src/app/api/export-xlsx/route.ts` | Core/Indefinido | MÉDIO | usage_events | - |
| `/api/governance/audit-logs` | `src/app/api/governance/audit-logs/route.ts` | Governança | BAIXO/MÉDIO | organization_audit_logs | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL |
| `/api/governance/auth/login` | `src/app/api/governance/auth/login/route.ts` | Governança | BAIXO/MÉDIO | organization_members, organizations, profiles | - |
| `/api/governance/chat` | `src/app/api/governance/chat/route.ts` | Governança | BAIXO/MÉDIO | governance_conversations, governance_messages, governance_official_gazette_chunks, institutional_documents, match_pdf_chunks, official_sources, pdf_files | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL, OPENAI_MODEL_GOVERNANCE, OPENAI_MODEL_NO_PDF, RAG_TOP_K |
| `/api/governance/conversations/[conversationId]` | `src/app/api/governance/conversations/[conversationId]/route.ts` | Governança | BAIXO/MÉDIO | governance_conversations | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `/api/governance/conversations` | `src/app/api/governance/conversations/route.ts` | Governança | BAIXO/MÉDIO | create_governance_conversation, governance_conversations | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL |
| `/api/governance/indicators` | `src/app/api/governance/indicators/route.ts` | Governança | BAIXO/MÉDIO | - | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL |
| `/api/governance/institutional-documents` | `src/app/api/governance/institutional-documents/route.ts` | Governança | BAIXO/MÉDIO | institutional_documents | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET, NEXT_PUBLIC_SUPABASE_URL, PDF_EXTRACT_MAX_MB, SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET |
| `/api/governance/messages` | `src/app/api/governance/messages/route.ts` | Governança | BAIXO/MÉDIO | governance_conversations, governance_messages | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL |
| `/api/governance/official-gazette-chunks` | `src/app/api/governance/official-gazette-chunks/route.ts` | Governança | BAIXO/MÉDIO | governance_official_gazette_chunks | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL |
| `/api/governance/official-gazette-documents` | `src/app/api/governance/official-gazette-documents/route.ts` | Governança | BAIXO/MÉDIO | governance_official_gazette_chunks, governance_official_gazette_documents, governance_official_gazettes | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET, NEXT_PUBLIC_SUPABASE_URL, PDF_EXTRACT_MAX_MB, SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET |
| `/api/governance/official-gazette` | `src/app/api/governance/official-gazette/route.ts` | Governança | BAIXO/MÉDIO | governance_official_gazettes | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL |
| `/api/governance/official-sources` | `src/app/api/governance/official-sources/route.ts` | Governança | BAIXO/MÉDIO | official_sources | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL |
| `/api/governance/users` | `src/app/api/governance/users/route.ts` | Governança | BAIXO/MÉDIO | organization_audit_logs, organization_members, profiles | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `/api/kiwify/webhook` | `src/app/api/kiwify/webhook/route.ts` | Essencial/Estratégico | MÉDIO | kiwify_webhook_logs, profiles, signup_tokens, user_access, user_access_grants | KIWIFY_WEBHOOK_SECRET |
| `/api/nexus-admin/organizations` | `src/app/api/nexus-admin/organizations/route.ts` | Admin/Core | MÉDIO | organization_audit_logs, organization_members, organizations, profiles | NEXUS_ADMIN_PASSWORD, NEXUS_ADMIN_USER |
| `/api/pdf/ask` | `src/app/api/pdf/ask/route.ts` | Core compartilhado | ALTO | pdf_files | OPENAI_API_KEY, OPENAI_CHAT_MODEL |
| `/api/pdf/detach` | `src/app/api/pdf/detach/route.ts` | Core compartilhado | ALTO | conversation_pdf_links, conversations | - |
| `/api/pdf/index` | `src/app/api/pdf/index/route.ts` | Core compartilhado | ALTO | pdf_files | GOVERNANCE_PDF_INDEX_MAX_MB, NODE_ENV |
| `/api/pdf/reprocess` | `src/app/api/pdf/reprocess/route.ts` | Core compartilhado | ALTO | - | NODE_ENV |
| `/api/public/share/[shareId]` | `src/app/api/public/share/[shareId]/route.ts` | Core compartilhado | ALTO | conversations, governance_conversations | NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `/api/public/share/create` | `src/app/api/public/share/create/route.ts` | Core compartilhado | ALTO | usage_events | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL |
| `/api/recuperar-senha` | `src/app/api/recuperar-senha/route.ts` | Autenticação/Core | MÉDIO | check_rate_limit, profiles | NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL |
| `/api/signup-token` | `src/app/api/signup-token/route.ts` | Autenticação/Core | MÉDIO | check_rate_limit, cleanup_signup_tokens, signup_tokens | NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `/api/upload-pdf` | `src/app/api/upload-pdf/route.ts` | Core compartilhado | ALTO | conversation_pdf_links, conversations, governance_conversations, pdf_files, usage_events | NEXT_PUBLIC_SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET, NEXT_PUBLIC_SUPABASE_PDF_BUCKET |

## Observação inicial

As rotas `pdf/*` e `upload-pdf` aparecem como **Core compartilhado**. Qualquer correção nelas pode afetar Essencial/Estratégico e Governança.
