# 07 — Matriz Inicial de Blindagem

Classificação inicial extraída por caminho e responsabilidade aparente.

| Arquivo | Domínio | Risco | Compartilhado |
|---|---|---|---|
| `src/app/(auth)/criar-conta/CriarContaPageClient.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/(auth)/criar-conta/SignupForm.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/(auth)/criar-conta/formActions.ts` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/(auth)/criar-conta/page.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/(auth)/login/LoginForm.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/(auth)/login/loginActions.ts` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/(auth)/login/page.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/(auth)/recuperar-senha/ResetForm.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/(auth)/recuperar-senha/page.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/(auth)/recuperar-senha/resetActions.ts` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/api/access/apply-token/route.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/api/access/me/route.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/api/access/start-strategic-trial/route.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/api/admin/audit-access/fix/route.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/api/admin/audit-access/inconsistencies/route.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/api/admin/audit-access/route.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/api/admin/reset-user-password/route.ts` | Admin/Core | MÉDIO | Parcial/Não |
| `src/app/api/chat/route.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/api/export-xlsx/route.ts` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/app/api/governance/audit-logs/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/auth/login/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/chat/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/conversations/[conversationId]/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/conversations/conversations-route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/conversations/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/indicators/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/institutional-documents/route.backup-v8-5.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/institutional-documents/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/messages/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/official-gazette-chunks/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/official-gazette-documents/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/official-gazette/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/official-sources/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/governance/users/route.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/api/kiwify/webhook/route.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/api/nexus-admin/organizations/route.ts` | Admin/Core | MÉDIO | Parcial/Não |
| `src/app/api/pdf/ask/route.ts` | Core compartilhado | ALTO | Sim |
| `src/app/api/pdf/detach/route.ts` | Core compartilhado | ALTO | Sim |
| `src/app/api/pdf/index/route.ts` | Core compartilhado | ALTO | Sim |
| `src/app/api/pdf/reprocess/route.ts` | Core compartilhado | ALTO | Sim |
| `src/app/api/public/share/[shareId]/route.ts` | Core compartilhado | ALTO | Sim |
| `src/app/api/public/share/create/route.ts` | Core compartilhado | ALTO | Sim |
| `src/app/api/recuperar-senha/route.ts` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/api/signup-token/route.ts` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/api/upload-pdf/route.ts` | Core compartilhado | ALTO | Sim |
| `src/app/api/upload-pdf/upload-pdf-route - Copia.ts` | Core compartilhado | ALTO | Sim |
| `src/app/atualizar-senha/page.tsx` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/app/auth/callback/route.ts` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/app/chat/ChatPageClient.tsx` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/chat/components/ChatEmptyState.tsx` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/chat/components/ChatHeader.tsx` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/chat/components/ChatInput.tsx` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/chat/components/ChatMessages.tsx` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/chat/components/ChatMessagesList.tsx` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/chat/components/ChatSidebar.tsx` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/chat/components/PdfAttachmentsBar.tsx` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/chat/page.tsx` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/chat/theme.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/chat/utils/alertStyles.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/error.tsx` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/app/global-error.tsx` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/app/governanca/GovernanceShell.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/auditoria/AuditLogsClient.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/auditoria/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/base-institucional/InstitutionalDocumentsClient.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/base-institucional/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/chat/GovernanceChatClient.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/chat/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/components/GovernanceHeader.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/components/GovernanceSidebar.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/conversas/GovernanceConversationsClient.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/conversas/[conversationId]/GovernanceConversationDetailClient.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/conversas/[conversationId]/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/conversas/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/diario-oficial/OfficialGazetteClient.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/diario-oficial/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/fontes-oficiais/OfficialSourcesClient.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/fontes-oficiais/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/indicadores/IndicatorsClient.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/indicadores/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/layout.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/login/GovernanceLoginForm.backup.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/login/GovernanceLoginForm.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/login/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/share/[shareId]/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/usuarios/GovernanceUserActions.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/usuarios/NewGovernanceUserForm.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/governanca/usuarios/page.tsx` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/app/layout.tsx` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/app/logout/route.ts` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/app/nexus-admin/layout.tsx` | Admin/Core | MÉDIO | Parcial/Não |
| `src/app/nexus-admin/organizacoes/NexusOrganizationsClient.tsx` | Admin/Core | MÉDIO | Parcial/Não |
| `src/app/nexus-admin/organizacoes/page.tsx` | Admin/Core | MÉDIO | Parcial/Não |
| `src/app/nexus-admin/page.tsx` | Admin/Core | MÉDIO | Parcial/Não |
| `src/app/p/[shareId]/SharedConversationClient.tsx` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/app/p/[shareId]/page.tsx` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/app/pagamento/retorno/page.tsx` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/app/page.tsx` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/components/Modal.tsx` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/components/auth/Alert.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/components/auth/AuthCard.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/components/auth/AuthInput.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/components/auth/AuthPasswordInput.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/components/auth/AuthShell.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/components/auth/AuthTitle.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/components/auth/SubmitButton.tsx` | Autenticação/Core | MÉDIO | Parcial/Não |
| `src/components/brand.tsx` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/components/password-input.tsx` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/lib/access-client.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/lib/access-control.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/lib/access-cta.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/lib/access/access-helpers.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/lib/access/applySignupTokenAccess.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/lib/access/getCurrentUserAccess.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/lib/access/products/product-mode.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/lib/access/reconcileUserAccessSnapshot.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/lib/access/resolveUserAccess.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/lib/copy/copyMessageToClipboard.ts` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/lib/external/supabase.ts` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/lib/governance/get-current-organization.ts` | Governança | BAIXO/MÉDIO | Parcial/Não |
| `src/lib/governanceCriticalKnowledge.ts` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/lib/governanceLegalGuardrails.ts` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/lib/hooks/useStickToBottom.ts` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/lib/pdf/chunking.ts` | Core compartilhado | ALTO | Sim |
| `src/lib/pdf/extract.ts` | Core compartilhado | ALTO | Sim |
| `src/lib/pdf/officialGazetteActNormalizer.ts` | Core compartilhado | ALTO | Sim |
| `src/lib/pdf/processForIndexing.ts` | Core compartilhado | ALTO | Sim |
| `src/lib/pdf/retrieveChunks.ts` | Core compartilhado | ALTO | Sim |
| `src/lib/publiaPrompt.ts` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/lib/supabase-browser.ts` | Core compartilhado | ALTO | Sim |
| `src/lib/supabase-server.ts` | Core compartilhado | ALTO | Sim |
| `src/lib/supabase/admin.ts` | Core compartilhado | ALTO | Sim |
| `src/lib/supabase/client.ts` | Core compartilhado | ALTO | Sim |
| `src/lib/supabase/index.ts` | Core compartilhado | ALTO | Sim |
| `src/lib/supabase/server.ts` | Core compartilhado | ALTO | Sim |
| `src/lib/validators.ts` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/lib/webFirstDetector.ts` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/middleware.ts` | Core/Indefinido | MÉDIO | Parcial/Não |
| `src/types/access.ts` | Essencial/Estratégico | MÉDIO | Parcial/Não |
| `src/types/governance.ts` | Core/Indefinido | MÉDIO | Parcial/Não |

## Regra operacional

Antes de alterar qualquer arquivo com risco **ALTO**, gerar relatório de impacto indicando:
1. quem chama o arquivo;
2. quais tabelas ele lê/escreve;
3. se afeta Essencial/Estratégico/Governança;
4. como testar cada produto após a alteração.
