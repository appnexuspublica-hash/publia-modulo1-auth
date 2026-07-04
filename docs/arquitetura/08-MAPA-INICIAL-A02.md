# Sprint A0.2 — Mapa Inicial de Engenharia Reversa do Publ.IA - MAPA-INICIAL
Fonte analisada: `publia-modulo1-auth.zip`.

Nenhum arquivo do projeto foi alterado. Este relatório foi gerado por leitura estática do código e documentação inclusa.
## 1. Resumo executivo
- Arquivos totais no ZIP: 650
- Arquivos úteis analisados, excluindo `.git`, `node_modules` e `.next`: 209
- Arquivos TypeScript/TSX em `src`: 141
- Rotas API identificadas: 33
- Variáveis de ambiente referenciadas no código: 28
- Tabelas/RPCs Supabase citadas: 27

## 2. Classificação inicial por domínio
- Governança: 47 arquivos TS/TSX
- Outro/Admin: 33 arquivos TS/TSX
- Essencial/Estratégico: 24 arquivos TS/TSX
- Autenticação: 20 arquivos TS/TSX
- Core compartilhado: 17 arquivos TS/TSX

## 3. Rotas API identificadas
| Rota | Arquivo |
|---|---|
| `/api/access/apply-token` | `src/app/api/access/apply-token/route.ts` |
| `/api/access/me` | `src/app/api/access/me/route.ts` |
| `/api/access/start-strategic-trial` | `src/app/api/access/start-strategic-trial/route.ts` |
| `/api/admin/audit-access` | `src/app/api/admin/audit-access/route.ts` |
| `/api/admin/audit-access/fix` | `src/app/api/admin/audit-access/fix/route.ts` |
| `/api/admin/audit-access/inconsistencies` | `src/app/api/admin/audit-access/inconsistencies/route.ts` |
| `/api/admin/reset-user-password` | `src/app/api/admin/reset-user-password/route.ts` |
| `/api/chat` | `src/app/api/chat/route.ts` |
| `/api/export-xlsx` | `src/app/api/export-xlsx/route.ts` |
| `/api/governance/audit-logs` | `src/app/api/governance/audit-logs/route.ts` |
| `/api/governance/auth/login` | `src/app/api/governance/auth/login/route.ts` |
| `/api/governance/chat` | `src/app/api/governance/chat/route.ts` |
| `/api/governance/conversations` | `src/app/api/governance/conversations/route.ts` |
| `/api/governance/conversations/[conversationId]` | `src/app/api/governance/conversations/[conversationId]/route.ts` |
| `/api/governance/indicators` | `src/app/api/governance/indicators/route.ts` |
| `/api/governance/institutional-documents` | `src/app/api/governance/institutional-documents/route.ts` |
| `/api/governance/messages` | `src/app/api/governance/messages/route.ts` |
| `/api/governance/official-gazette` | `src/app/api/governance/official-gazette/route.ts` |
| `/api/governance/official-gazette-chunks` | `src/app/api/governance/official-gazette-chunks/route.ts` |
| `/api/governance/official-gazette-documents` | `src/app/api/governance/official-gazette-documents/route.ts` |
| `/api/governance/official-sources` | `src/app/api/governance/official-sources/route.ts` |
| `/api/governance/users` | `src/app/api/governance/users/route.ts` |
| `/api/kiwify/webhook` | `src/app/api/kiwify/webhook/route.ts` |
| `/api/nexus-admin/organizations` | `src/app/api/nexus-admin/organizations/route.ts` |
| `/api/pdf/ask` | `src/app/api/pdf/ask/route.ts` |
| `/api/pdf/detach` | `src/app/api/pdf/detach/route.ts` |
| `/api/pdf/index` | `src/app/api/pdf/index/route.ts` |
| `/api/pdf/reprocess` | `src/app/api/pdf/reprocess/route.ts` |
| `/api/public/share/[shareId]` | `src/app/api/public/share/[shareId]/route.ts` |
| `/api/public/share/create` | `src/app/api/public/share/create/route.ts` |
| `/api/recuperar-senha` | `src/app/api/recuperar-senha/route.ts` |
| `/api/signup-token` | `src/app/api/signup-token/route.ts` |
| `/api/upload-pdf` | `src/app/api/upload-pdf/route.ts` |

## 4. Variáveis de ambiente identificadas
| Variável | Qtde. arquivos |
|---|---:|
| `ADMIN_INTERNAL_API_KEY` | 1 |
| `GOVERNANCE_PDF_INDEX_MAX_MB` | 1 |
| `KIWIFY_WEBHOOK_SECRET` | 1 |
| `NEXT_PUBLIC_AFTER_SIGNUP_LOGIN` | 1 |
| `NEXT_PUBLIC_SITE_URL` | 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 31 |
| `NEXT_PUBLIC_SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET` | 7 |
| `NEXT_PUBLIC_SUPABASE_PDF_BUCKET` | 4 |
| `NEXT_PUBLIC_SUPABASE_URL` | 40 |
| `NEXUS_ADMIN_PASSWORD` | 1 |
| `NEXUS_ADMIN_USER` | 1 |
| `NODE_ENV` | 3 |
| `OPENAI_API_KEY` | 6 |
| `OPENAI_CHAT_MODEL` | 1 |
| `OPENAI_EMBEDDING_MODEL` | 3 |
| `OPENAI_MODEL` | 1 |
| `OPENAI_MODEL_GOVERNANCE` | 1 |
| `OPENAI_MODEL_NO_PDF` | 2 |
| `OPENAI_OCR_MODEL` | 1 |
| `OPENAI_PDF_OCR_MODEL` | 1 |
| `PDF_EXTRACT_MAX_MB` | 4 |
| `PDF_INDIVIDUAL_PREFER_OCR` | 1 |
| `PDF_OCR_ENABLED` | 1 |
| `PDF_OCR_MAX_MB` | 1 |
| `PDF_OCR_MIN_TEXT_LENGTH` | 1 |
| `RAG_TOP_K` | 1 |
| `SUPABASE_GOVERNANCE_DOCUMENTS_BUCKET` | 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | 12 |

## 5. Tabelas/RPCs Supabase identificadas
| Tabela/RPC | Qtde. arquivos |
|---|---:|
| `check_rate_limit` | 3 |
| `cleanup_signup_tokens` | 2 |
| `conversation_pdf_links` | 4 |
| `conversations` | 7 |
| `create_governance_conversation` | 2 |
| `governance_conversations` | 12 |
| `governance_messages` | 7 |
| `governance_official_gazette_chunks` | 3 |
| `governance_official_gazette_documents` | 1 |
| `governance_official_gazettes` | 2 |
| `institutional_documents` | 4 |
| `kiwify_webhook_logs` | 1 |
| `match_pdf_chunks` | 2 |
| `messages` | 3 |
| `official_sources` | 2 |
| `organization_audit_logs` | 3 |
| `organization_members` | 5 |
| `organizations` | 2 |
| `pdf-files` | 1 |
| `pdf_chunks` | 1 |
| `pdf_files` | 9 |
| `profiles` | 22 |
| `signup_tokens` | 6 |
| `usage_events` | 5 |
| `user_access` | 8 |
| `user_access_grants` | 7 |
| `user_access_summary` | 1 |

## 6. Arquivos mais acoplados por importação interna
| Alvo importado | Nº importações aproximado |
|---|---:|
| `src/types/governance` | 27 |
| `src/lib/governance/get-current-organization` | 24 |
| `src/lib/supabase/admin` | 12 |
| `src/lib/supabase/server` | 11 |
| `../components/GovernanceHeader` | 8 |
| `src/lib/access/resolveUserAccess` | 7 |
| `../components/GovernanceSidebar` | 7 |
| `src/types/access` | 6 |
| `src/lib/access/getCurrentUserAccess` | 6 |
| `src/lib/access-control` | 6 |
| `src/lib/access/reconcileUserAccessSnapshot` | 5 |
| `src/app/chat/theme` | 5 |
| `src/lib/pdf/extract` | 4 |
| `src/lib/access/applySignupTokenAccess` | 4 |
| `src/components/auth/AuthInput` | 4 |
| `src/components/auth/Alert` | 4 |
| `src/lib/supabase/client` | 3 |
| `src/lib/validators` | 3 |
| `src/components/auth/AuthShell` | 3 |
| `src/components/auth/SubmitButton` | 3 |

## 7. Pontos de maior risco inicial
- `src/app/api/chat/route.ts`
- `src/app/chat/ChatPageClient.tsx`
- `src/app/api/upload-pdf/route.ts`
- `src/app/api/pdf/index/route.ts`
- `src/app/api/pdf/ask/route.ts`
- `src/lib/pdf/processForIndexing.ts`
- `src/lib/pdf/retrieveChunks.ts`
- `src/lib/pdf/extract.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/admin.ts`
- `src/app/api/governance/chat/route.ts`
- `src/app/api/governance/institutional-documents/route.ts`

## 8. Observações de segurança
- O ZIP contém `.env.local`. O conteúdo não foi exibido nem copiado neste relatório. Este arquivo não deve ser enviado para repositórios públicos nem compartilhado sem necessidade.
- O ZIP contém pasta `.git/`. Para handoffs futuros, recomenda-se gerar pacote sem `.git`, `.next`, `node_modules` e `.env.local`.

## 9. Próximo passo recomendado
Consolidar a Matriz de Dependências completa com: fluxo de chat, fluxo de PDF, fluxo de Governança, fluxo de autenticação e pontos exatos de fronteira entre Core, Essencial, Estratégico e Governança.
