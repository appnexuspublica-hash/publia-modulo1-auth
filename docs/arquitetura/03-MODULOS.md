# 03 — Mapa de Módulos

Classificação inicial por caminho/nome do arquivo.

## Autenticação/Core

- `src/app/(auth)/criar-conta/CriarContaPageClient.tsx`
- `src/app/(auth)/criar-conta/SignupForm.tsx`
- `src/app/(auth)/criar-conta/formActions.ts`
- `src/app/(auth)/criar-conta/page.tsx`
- `src/app/(auth)/login/LoginForm.tsx`
- `src/app/(auth)/login/loginActions.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/recuperar-senha/ResetForm.tsx`
- `src/app/(auth)/recuperar-senha/page.tsx`
- `src/app/(auth)/recuperar-senha/resetActions.ts`
- `src/app/api/recuperar-senha/route.ts`
- `src/app/api/signup-token/route.ts`
- `src/app/auth/callback/route.ts`
- `src/components/auth/Alert.tsx`
- `src/components/auth/AuthCard.tsx`
- `src/components/auth/AuthInput.tsx`
- `src/components/auth/AuthPasswordInput.tsx`
- `src/components/auth/AuthShell.tsx`
- `src/components/auth/AuthTitle.tsx`
- `src/components/auth/SubmitButton.tsx`

## Essencial/Estratégico

- `src/app/api/access/apply-token/route.ts`
- `src/app/api/access/me/route.ts`
- `src/app/api/access/start-strategic-trial/route.ts`
- `src/app/api/admin/audit-access/fix/route.ts`
- `src/app/api/admin/audit-access/inconsistencies/route.ts`
- `src/app/api/admin/audit-access/route.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/kiwify/webhook/route.ts`
- `src/app/chat/ChatPageClient.tsx`
- `src/app/chat/components/ChatEmptyState.tsx`
- `src/app/chat/components/ChatHeader.tsx`
- `src/app/chat/components/ChatInput.tsx`
- `src/app/chat/components/ChatMessages.tsx`
- `src/app/chat/components/ChatMessagesList.tsx`
- `src/app/chat/components/ChatSidebar.tsx`
- `src/app/chat/components/PdfAttachmentsBar.tsx`
- `src/app/chat/page.tsx`
- `src/app/chat/theme.ts`
- `src/app/chat/utils/alertStyles.ts`
- `src/app/pagamento/retorno/page.tsx`
- `src/lib/access-client.ts`
- `src/lib/access-control.ts`
- `src/lib/access-cta.ts`
- `src/lib/access/access-helpers.ts`
- `src/lib/access/applySignupTokenAccess.ts`
- `src/lib/access/getCurrentUserAccess.ts`
- `src/lib/access/products/product-mode.ts`
- `src/lib/access/reconcileUserAccessSnapshot.ts`
- `src/lib/access/resolveUserAccess.ts`
- `src/types/access.ts`

## Admin/Core

- `src/app/api/admin/reset-user-password/route.ts`
- `src/app/api/nexus-admin/organizations/route.ts`
- `src/app/nexus-admin/layout.tsx`
- `src/app/nexus-admin/organizacoes/NexusOrganizationsClient.tsx`
- `src/app/nexus-admin/organizacoes/page.tsx`
- `src/app/nexus-admin/page.tsx`

## Core/Indefinido

- `src/app/api/export-xlsx/route.ts`
- `src/app/atualizar-senha/page.tsx`
- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/logout/route.ts`
- `src/app/p/[shareId]/SharedConversationClient.tsx`
- `src/app/p/[shareId]/page.tsx`
- `src/app/page.tsx`
- `src/components/Modal.tsx`
- `src/components/brand.tsx`
- `src/components/password-input.tsx`
- `src/lib/copy/copyMessageToClipboard.ts`
- `src/lib/external/supabase.ts`
- `src/lib/governanceCriticalKnowledge.ts`
- `src/lib/governanceLegalGuardrails.ts`
- `src/lib/hooks/useStickToBottom.ts`
- `src/lib/publiaPrompt.ts`
- `src/lib/validators.ts`
- `src/lib/webFirstDetector.ts`
- `src/middleware.ts`
- `src/types/governance.ts`

## Governança

- `src/app/api/governance/audit-logs/route.ts`
- `src/app/api/governance/auth/login/route.ts`
- `src/app/api/governance/chat/route.ts`
- `src/app/api/governance/conversations/[conversationId]/route.ts`
- `src/app/api/governance/conversations/conversations-route.ts`
- `src/app/api/governance/conversations/route.ts`
- `src/app/api/governance/indicators/route.ts`
- `src/app/api/governance/institutional-documents/route.backup-v8-5.ts`
- `src/app/api/governance/institutional-documents/route.ts`
- `src/app/api/governance/messages/route.ts`
- `src/app/api/governance/official-gazette-chunks/route.ts`
- `src/app/api/governance/official-gazette-documents/route.ts`
- `src/app/api/governance/official-gazette/route.ts`
- `src/app/api/governance/official-sources/route.ts`
- `src/app/api/governance/users/route.ts`
- `src/app/governanca/GovernanceShell.tsx`
- `src/app/governanca/auditoria/AuditLogsClient.tsx`
- `src/app/governanca/auditoria/page.tsx`
- `src/app/governanca/base-institucional/InstitutionalDocumentsClient.tsx`
- `src/app/governanca/base-institucional/page.tsx`
- `src/app/governanca/chat/GovernanceChatClient.tsx`
- `src/app/governanca/chat/page.tsx`
- `src/app/governanca/components/GovernanceHeader.tsx`
- `src/app/governanca/components/GovernanceSidebar.tsx`
- `src/app/governanca/conversas/GovernanceConversationsClient.tsx`
- `src/app/governanca/conversas/[conversationId]/GovernanceConversationDetailClient.tsx`
- `src/app/governanca/conversas/[conversationId]/page.tsx`
- `src/app/governanca/conversas/page.tsx`
- `src/app/governanca/diario-oficial/OfficialGazetteClient.tsx`
- `src/app/governanca/diario-oficial/page.tsx`
- `src/app/governanca/fontes-oficiais/OfficialSourcesClient.tsx`
- `src/app/governanca/fontes-oficiais/page.tsx`
- `src/app/governanca/indicadores/IndicatorsClient.tsx`
- `src/app/governanca/indicadores/page.tsx`
- `src/app/governanca/layout.tsx`
- `src/app/governanca/login/GovernanceLoginForm.backup.tsx`
- `src/app/governanca/login/GovernanceLoginForm.tsx`
- `src/app/governanca/login/page.tsx`
- `src/app/governanca/page.tsx`
- `src/app/governanca/share/[shareId]/page.tsx`
- `src/app/governanca/usuarios/GovernanceUserActions.tsx`
- `src/app/governanca/usuarios/NewGovernanceUserForm.tsx`
- `src/app/governanca/usuarios/page.tsx`
- `src/lib/governance/get-current-organization.ts`

## Core compartilhado

- `src/app/api/pdf/ask/route.ts`
- `src/app/api/pdf/detach/route.ts`
- `src/app/api/pdf/index/route.ts`
- `src/app/api/pdf/reprocess/route.ts`
- `src/app/api/public/share/[shareId]/route.ts`
- `src/app/api/public/share/create/route.ts`
- `src/app/api/upload-pdf/route.ts`
- `src/app/api/upload-pdf/route.ts.bak`
- `src/app/api/upload-pdf/upload-pdf-route - Copia.ts`
- `src/lib/pdf/chunking.ts`
- `src/lib/pdf/extract.ts`
- `src/lib/pdf/officialGazetteActNormalizer.ts`
- `src/lib/pdf/processForIndexing.ts`
- `src/lib/pdf/processForIndexing.ts.bak`
- `src/lib/pdf/retrieveChunks.ts`
- `src/lib/supabase-browser.ts`
- `src/lib/supabase-server.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/index.ts`
- `src/lib/supabase/server.ts`

