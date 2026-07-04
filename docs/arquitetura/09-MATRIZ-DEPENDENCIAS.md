# 09-MATRIZ-DEPENDENCIAS
## Status

**Sprint:** A0.2 – Engenharia Reversa  
**Documento:** 09-MATRIZ-DEPENDENCIAS  
**Situação:** Em elaboração inicial  
**Base analisada:** `publia-modulo1-auth.zip`  
**Regra:** documento de análise; não altera código.
---

## Objetivo

Mapear dependências entre rotas, bibliotecas, componentes e domínios do Publ.IA para apoiar análise de impacto antes de qualquer alteração.
---

## Critérios de impacto

- 🔴 **Alto:** arquivo compartilhado, infraestrutura crítica ou muito reutilizado.
- 🟡 **Médio:** arquivo de domínio específico, rota API ou usado por poucos pontos.
- 🟢 **Baixo:** arquivo isolado, página/componente específico ou baixa reutilização.
---

## Resumo quantitativo

- Arquivos TS/TSX/JS/JSX analisados em `src/`: **141**
- Rotas API identificadas: **33**
- Arquivos críticos iniciais: **96**
- Arquivos de médio impacto: **15**

---

## Arquivos mais reutilizados

| Arquivo | Domínio | Usado por | Impacto |
|---|---|---:|---|
| `src/types/governance.ts` | Governança | 27 | 🔴 Alto |
| `src/lib/governance/get-current-organization.ts` | Governança | 24 | 🔴 Alto |
| `src/lib/supabase/admin.ts` | Core | 13 | 🔴 Alto |
| `src/lib/supabase/server.ts` | Core | 12 | 🔴 Alto |
| `src/lib/access/resolveUserAccess.ts` | Core/Auth/Acesso | 8 | 🔴 Alto |
| `src/lib/access/getCurrentUserAccess.ts` | Core/Auth/Acesso | 6 | 🔴 Alto |
| `src/lib/access-control.ts` | Core/Auth/Acesso | 6 | 🔴 Alto |
| `src/types/access.ts` | Compartilhado/Outro | 6 | 🔴 Alto |
| `src/lib/access/reconcileUserAccessSnapshot.ts` | Core/Auth/Acesso | 5 | 🔴 Alto |
| `src/app/chat/theme.ts` | Essencial/Estratégico compartilhado | 5 | 🔴 Alto |
| `src/components/auth/AuthInput.tsx` | Core/Auth/Acesso | 4 | 🔴 Alto |
| `src/components/auth/Alert.tsx` | Core/Auth/Acesso | 4 | 🔴 Alto |
| `src/lib/access/applySignupTokenAccess.ts` | Core/Auth/Acesso | 4 | 🔴 Alto |
| `src/lib/pdf/extract.ts` | Core | 4 | 🔴 Alto |
| `src/components/auth/AuthShell.tsx` | Core/Auth/Acesso | 3 | 🔴 Alto |
| `src/components/auth/SubmitButton.tsx` | Core/Auth/Acesso | 3 | 🔴 Alto |
| `src/components/auth/AuthPasswordInput.tsx` | Core/Auth/Acesso | 3 | 🔴 Alto |
| `src/lib/validators.ts` | Core | 3 | 🔴 Alto |
| `src/lib/supabase/client.ts` | Core | 3 | 🔴 Alto |
| `src/app/(auth)/criar-conta/formActions.ts` | Core/Auth/Acesso | 2 | 🔴 Alto |

---

## Rotas API identificadas

| Rota | Domínio provável | Dependências internas principais | Impacto |
|---|---|---|---|
| `src/app/api/access/apply-token/route.ts` | Core/Auth/Acesso | `src/lib/access/applySignupTokenAccess.ts`<br>`src/lib/supabase/server.ts` | 🔴 Alto |
| `src/app/api/access/me/route.ts` | Core/Auth/Acesso | `src/lib/access-control.ts`<br>`src/lib/access/access-helpers.ts`<br>`src/lib/access/applySignupTokenAccess.ts`<br>... +4 | 🔴 Alto |
| `src/app/api/access/start-strategic-trial/route.ts` | Core/Auth/Acesso | `src/lib/access/applySignupTokenAccess.ts`<br>`src/lib/access/getCurrentUserAccess.ts`<br>`src/lib/access/reconcileUserAccessSnapshot.ts`<br>... +1 | 🔴 Alto |
| `src/app/api/admin/audit-access/fix/route.ts` | Compartilhado/Outro | `src/lib/access/reconcileUserAccessSnapshot.ts`<br>`src/lib/access/resolveUserAccess.ts`<br>`src/lib/supabase/admin.ts` | 🔴 Alto |
| `src/app/api/admin/audit-access/inconsistencies/route.ts` | Compartilhado/Outro | `src/lib/access/resolveUserAccess.ts`<br>`src/lib/supabase/admin.ts` | 🔴 Alto |
| `src/app/api/admin/audit-access/route.ts` | Compartilhado/Outro | `src/lib/access/resolveUserAccess.ts`<br>`src/lib/supabase/admin.ts` | 🔴 Alto |
| `src/app/api/admin/reset-user-password/route.ts` | Compartilhado/Outro | `src/lib/supabase/admin.ts` | 🔴 Alto |
| `src/app/api/chat/route.ts` | Essencial/Estratégico compartilhado | `src/lib/access/access-helpers.ts`<br>`src/lib/access/getCurrentUserAccess.ts`<br>`src/lib/publiaPrompt.ts` | 🔴 Alto |
| `src/app/api/export-xlsx/route.ts` | Compartilhado/Outro | `src/lib/supabase/server.ts` | 🔴 Alto |
| `src/app/api/governance/audit-logs/route.ts` | Governança | `src/lib/governance/get-current-organization.ts` | 🟡 Médio |
| `src/app/api/governance/auth/login/route.ts` | Governança | `src/lib/supabase/admin.ts` | 🟡 Médio |
| `src/app/api/governance/chat/route.ts` | Governança | `src/lib/governance/get-current-organization.ts`<br>`src/lib/governanceLegalGuardrails.ts`<br>`src/lib/pdf/chunking.ts`<br>... +3 | 🟡 Médio |
| `src/app/api/governance/conversations/[conversationId]/route.ts` | Governança | `src/lib/governance/get-current-organization.ts` | 🟡 Médio |
| `src/app/api/governance/conversations/route.ts` | Governança | `src/lib/governance/get-current-organization.ts`<br>`src/types/governance.ts` | 🟡 Médio |
| `src/app/api/governance/indicators/route.ts` | Governança | `src/lib/governance/get-current-organization.ts` | 🟡 Médio |
| `src/app/api/governance/institutional-documents/route.ts` | Governança | `src/lib/governance/get-current-organization.ts`<br>`src/lib/pdf/extract.ts` | 🟡 Médio |
| `src/app/api/governance/messages/route.ts` | Governança | `src/lib/governance/get-current-organization.ts` | 🟡 Médio |
| `src/app/api/governance/official-gazette-chunks/route.ts` | Governança | `src/lib/governance/get-current-organization.ts`<br>`src/lib/pdf/officialGazetteActNormalizer.ts` | 🟡 Médio |
| `src/app/api/governance/official-gazette-documents/route.ts` | Governança | `src/lib/governance/get-current-organization.ts`<br>`src/lib/pdf/extract.ts`<br>`src/lib/pdf/officialGazetteActNormalizer.ts` | 🟡 Médio |
| `src/app/api/governance/official-gazette/route.ts` | Governança | `src/lib/governance/get-current-organization.ts` | 🟡 Médio |
| `src/app/api/governance/official-sources/route.ts` | Governança | `src/lib/governance/get-current-organization.ts` | 🟡 Médio |
| `src/app/api/governance/users/route.ts` | Governança | `src/lib/governance/get-current-organization.ts`<br>`src/types/governance.ts` | 🟡 Médio |
| `src/app/api/kiwify/webhook/route.ts` | Compartilhado/Outro | `src/lib/access/getCurrentUserAccess.ts`<br>`src/lib/access/reconcileUserAccessSnapshot.ts`<br>`src/lib/access/resolveUserAccess.ts`<br>... +1 | 🔴 Alto |
| `src/app/api/nexus-admin/organizations/route.ts` | Compartilhado/Outro | `src/lib/supabase/admin.ts`<br>`src/types/governance.ts` | 🔴 Alto |
| `src/app/api/pdf/ask/route.ts` | Essencial/Estratégico compartilhado | `src/lib/access-control.ts`<br>`src/lib/pdf/retrieveChunks.ts`<br>`src/lib/supabase/server.ts` | 🔴 Alto |
| `src/app/api/pdf/detach/route.ts` | Essencial/Estratégico compartilhado | `src/lib/supabase/server.ts` | 🔴 Alto |
| `src/app/api/pdf/index/route.ts` | Essencial/Estratégico compartilhado | `src/lib/access-control.ts`<br>`src/lib/pdf/processForIndexing.ts`<br>`src/lib/supabase/server.ts` | 🔴 Alto |
| `src/app/api/pdf/reprocess/route.ts` | Essencial/Estratégico compartilhado | `src/lib/access-control.ts`<br>`src/lib/pdf/processForIndexing.ts`<br>`src/lib/supabase/server.ts` | 🔴 Alto |
| `src/app/api/public/share/[shareId]/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/api/public/share/create/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/api/recuperar-senha/route.ts` | Core/Auth/Acesso | `src/lib/supabase/admin.ts`<br>`src/lib/validators.ts` | 🔴 Alto |
| `src/app/api/signup-token/route.ts` | Core/Auth/Acesso | - | 🔴 Alto |
| `src/app/api/upload-pdf/route.ts` | Essencial/Estratégico compartilhado | `src/lib/access-control.ts`<br>`src/lib/supabase/admin.ts`<br>`src/lib/supabase/server.ts`<br>... +1 | 🔴 Alto |

---

## Matriz inicial por arquivos críticos

| Arquivo | Domínio | Utilizado por | Impacto |
|---|---|---|---|
| `src/types/access.ts` | Compartilhado/Outro | `src/app/api/access/me/route.ts`<br>`src/app/api/upload-pdf/route.ts`<br>`src/app/api/upload-pdf/upload-pdf-route - Copia.ts`<br>`src/app/chat/components/ChatSidebar.tsx`<br>... +2 | 🔴 Alto |
| `src/lib/copy/copyMessageToClipboard.ts` | Compartilhado/Outro | `src/app/chat/ChatPageClient.tsx`<br>`src/app/p/[shareId]/SharedConversationClient.tsx` | 🔴 Alto |
| `src/lib/publiaPrompt.ts` | Compartilhado/Outro | `src/app/api/chat/route.ts`<br>`src/app/api/governance/chat/route.ts` | 🔴 Alto |
| `src/app/nexus-admin/organizacoes/NexusOrganizationsClient.tsx` | Compartilhado/Outro | `src/app/nexus-admin/organizacoes/page.tsx` | 🔴 Alto |
| `src/app/p/[shareId]/SharedConversationClient.tsx` | Compartilhado/Outro | `src/app/p/[shareId]/page.tsx` | 🔴 Alto |
| `src/lib/webFirstDetector.ts` | Compartilhado/Outro | `src/app/api/governance/chat/route.ts` | 🔴 Alto |
| `src/app/api/admin/audit-access/fix/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/api/admin/audit-access/inconsistencies/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/api/admin/audit-access/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/api/admin/reset-user-password/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/api/export-xlsx/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/api/kiwify/webhook/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/api/nexus-admin/organizations/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/api/public/share/[shareId]/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/api/public/share/create/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/atualizar-senha/page.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/auth/callback/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/error.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/global-error.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/layout.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/logout/route.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/nexus-admin/layout.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/nexus-admin/organizacoes/page.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/nexus-admin/page.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/p/[shareId]/page.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/pagamento/retorno/page.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/app/page.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/components/Modal.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/components/brand.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/components/password-input.tsx` | Compartilhado/Outro | - | 🔴 Alto |
| `src/lib/external/supabase.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/lib/hooks/useStickToBottom.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/middleware.ts` | Compartilhado/Outro | - | 🔴 Alto |
| `src/lib/supabase/admin.ts` | Core | `src/app/(auth)/login/loginActions.ts`<br>`src/app/api/access/me/route.ts`<br>`src/app/api/admin/audit-access/fix/route.ts`<br>`src/app/api/admin/audit-access/inconsistencies/route.ts`<br>... +9 | 🔴 Alto |
| `src/lib/supabase/server.ts` | Core | `src/app/(auth)/login/loginActions.ts`<br>`src/app/api/access/apply-token/route.ts`<br>`src/app/api/access/start-strategic-trial/route.ts`<br>`src/app/api/export-xlsx/route.ts`<br>... +8 | 🔴 Alto |
| `src/lib/pdf/extract.ts` | Core | `src/app/api/governance/institutional-documents/route.backup-v8-5.ts`<br>`src/app/api/governance/institutional-documents/route.ts`<br>`src/app/api/governance/official-gazette-documents/route.ts`<br>`src/lib/pdf/processForIndexing.ts` | 🔴 Alto |
| `src/lib/supabase/client.ts` | Core | `src/app/atualizar-senha/page.tsx`<br>`src/app/governanca/login/GovernanceLoginForm.backup.tsx`<br>`src/app/governanca/login/GovernanceLoginForm.tsx` | 🔴 Alto |
| `src/lib/validators.ts` | Core | `src/app/(auth)/criar-conta/formActions.ts`<br>`src/app/(auth)/login/loginActions.ts`<br>`src/app/api/recuperar-senha/route.ts` | 🔴 Alto |
| `src/lib/pdf/chunking.ts` | Core | `src/app/api/governance/chat/route.ts`<br>`src/lib/pdf/processForIndexing.ts` | 🔴 Alto |
| `src/lib/pdf/officialGazetteActNormalizer.ts` | Core | `src/app/api/governance/official-gazette-chunks/route.ts`<br>`src/app/api/governance/official-gazette-documents/route.ts` | 🔴 Alto |
| `src/lib/pdf/processForIndexing.ts` | Core | `src/app/api/pdf/index/route.ts`<br>`src/app/api/pdf/reprocess/route.ts` | 🔴 Alto |
| `src/lib/pdf/retrieveChunks.ts` | Core | `src/app/api/pdf/ask/route.ts` | 🔴 Alto |
| `src/lib/supabase-browser.ts` | Core | - | 🔴 Alto |
| `src/lib/supabase-server.ts` | Core | - | 🔴 Alto |
| `src/lib/supabase/index.ts` | Core | - | 🔴 Alto |
| `src/lib/access/resolveUserAccess.ts` | Core/Auth/Acesso | `src/app/api/admin/audit-access/fix/route.ts`<br>`src/app/api/admin/audit-access/inconsistencies/route.ts`<br>`src/app/api/admin/audit-access/route.ts`<br>`src/app/api/kiwify/webhook/route.ts`<br>... +4 | 🔴 Alto |
| `src/lib/access-control.ts` | Core/Auth/Acesso | `src/app/api/access/me/route.ts`<br>`src/app/api/pdf/ask/route.ts`<br>`src/app/api/pdf/index/route.ts`<br>`src/app/api/pdf/reprocess/route.ts`<br>... +2 | 🔴 Alto |
| `src/lib/access/getCurrentUserAccess.ts` | Core/Auth/Acesso | `src/app/api/access/me/route.ts`<br>`src/app/api/access/start-strategic-trial/route.ts`<br>`src/app/api/chat/route.ts`<br>`src/app/api/kiwify/webhook/route.ts`<br>... +2 | 🔴 Alto |
| `src/lib/access/reconcileUserAccessSnapshot.ts` | Core/Auth/Acesso | `src/app/api/access/me/route.ts`<br>`src/app/api/access/start-strategic-trial/route.ts`<br>`src/app/api/admin/audit-access/fix/route.ts`<br>`src/app/api/kiwify/webhook/route.ts`<br>... +1 | 🔴 Alto |
| `src/components/auth/Alert.tsx` | Core/Auth/Acesso | `src/app/(auth)/criar-conta/CriarContaPageClient.tsx`<br>`src/app/(auth)/criar-conta/SignupForm.tsx`<br>`src/app/(auth)/login/page.tsx`<br>`src/app/(auth)/recuperar-senha/ResetForm.tsx` | 🔴 Alto |
| `src/components/auth/AuthInput.tsx` | Core/Auth/Acesso | `src/app/(auth)/criar-conta/CriarContaPageClient.tsx`<br>`src/app/(auth)/criar-conta/SignupForm.tsx`<br>`src/app/(auth)/login/page.tsx`<br>`src/app/(auth)/recuperar-senha/ResetForm.tsx` | 🔴 Alto |
| `src/lib/access/applySignupTokenAccess.ts` | Core/Auth/Acesso | `src/app/(auth)/criar-conta/formActions.ts`<br>`src/app/api/access/apply-token/route.ts`<br>`src/app/api/access/me/route.ts`<br>`src/app/api/access/start-strategic-trial/route.ts` | 🔴 Alto |
| `src/components/auth/AuthPasswordInput.tsx` | Core/Auth/Acesso | `src/app/(auth)/criar-conta/CriarContaPageClient.tsx`<br>`src/app/(auth)/criar-conta/SignupForm.tsx`<br>`src/app/(auth)/login/page.tsx` | 🔴 Alto |
| `src/components/auth/AuthShell.tsx` | Core/Auth/Acesso | `src/app/(auth)/criar-conta/CriarContaPageClient.tsx`<br>`src/app/(auth)/login/page.tsx`<br>`src/app/(auth)/recuperar-senha/ResetForm.tsx` | 🔴 Alto |
| `src/components/auth/SubmitButton.tsx` | Core/Auth/Acesso | `src/app/(auth)/criar-conta/CriarContaPageClient.tsx`<br>`src/app/(auth)/criar-conta/SignupForm.tsx`<br>`src/app/(auth)/login/page.tsx` | 🔴 Alto |
| `src/app/(auth)/criar-conta/formActions.ts` | Core/Auth/Acesso | `src/app/(auth)/criar-conta/CriarContaPageClient.tsx`<br>`src/app/(auth)/criar-conta/SignupForm.tsx` | 🔴 Alto |
| `src/app/(auth)/login/loginActions.ts` | Core/Auth/Acesso | `src/app/(auth)/login/LoginForm.tsx`<br>`src/app/(auth)/login/page.tsx` | 🔴 Alto |
| `src/lib/access-client.ts` | Core/Auth/Acesso | `src/app/chat/ChatPageClient.tsx`<br>`src/app/chat/components/ChatSidebar.tsx` | 🔴 Alto |
| `src/lib/access-cta.ts` | Core/Auth/Acesso | `src/app/chat/ChatPageClient.tsx`<br>`src/app/chat/components/ChatSidebar.tsx` | 🔴 Alto |
| `src/lib/access/access-helpers.ts` | Core/Auth/Acesso | `src/app/api/access/me/route.ts`<br>`src/app/api/chat/route.ts` | 🔴 Alto |

---

## Dependências por domínio

### Core

Arquivos centrais encontrados em `src/lib/supabase`, `src/lib/pdf`, utilitários e integrações.

- `src/app/(auth)/criar-conta/CriarContaPageClient.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/(auth)/criar-conta/SignupForm.tsx` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/(auth)/criar-conta/formActions.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/app/(auth)/criar-conta/page.tsx` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/(auth)/login/LoginForm.tsx` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/(auth)/login/loginActions.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/app/(auth)/login/page.tsx` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/(auth)/recuperar-senha/ResetForm.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/(auth)/recuperar-senha/page.tsx` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/(auth)/recuperar-senha/resetActions.ts` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/api/access/apply-token/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/access/me/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/access/start-strategic-trial/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/recuperar-senha/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/signup-token/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/components/auth/Alert.tsx` — 🔴 Alto — usado por 4 arquivo(s).
- `src/components/auth/AuthCard.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/components/auth/AuthInput.tsx` — 🔴 Alto — usado por 4 arquivo(s).
- `src/components/auth/AuthPasswordInput.tsx` — 🔴 Alto — usado por 3 arquivo(s).
- `src/components/auth/AuthShell.tsx` — 🔴 Alto — usado por 3 arquivo(s).
- `src/components/auth/AuthTitle.tsx` — 🔴 Alto — usado por 0 arquivo(s).
- `src/components/auth/SubmitButton.tsx` — 🔴 Alto — usado por 3 arquivo(s).
- `src/lib/access-client.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/lib/access-control.ts` — 🔴 Alto — usado por 6 arquivo(s).
- `src/lib/access-cta.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/lib/access/access-helpers.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/lib/access/applySignupTokenAccess.ts` — 🔴 Alto — usado por 4 arquivo(s).
- `src/lib/access/getCurrentUserAccess.ts` — 🔴 Alto — usado por 6 arquivo(s).
- `src/lib/access/products/product-mode.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/lib/access/reconcileUserAccessSnapshot.ts` — 🔴 Alto — usado por 5 arquivo(s).

### Autenticação e Acesso

- `src/app/(auth)/criar-conta/CriarContaPageClient.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/(auth)/criar-conta/formActions.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/app/(auth)/login/loginActions.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/app/(auth)/recuperar-senha/ResetForm.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/(auth)/recuperar-senha/resetActions.ts` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/api/access/apply-token/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/access/me/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/access/start-strategic-trial/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/recuperar-senha/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/signup-token/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/components/auth/Alert.tsx` — 🔴 Alto — usado por 4 arquivo(s).
- `src/components/auth/AuthCard.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/components/auth/AuthInput.tsx` — 🔴 Alto — usado por 4 arquivo(s).
- `src/components/auth/AuthPasswordInput.tsx` — 🔴 Alto — usado por 3 arquivo(s).
- `src/components/auth/AuthShell.tsx` — 🔴 Alto — usado por 3 arquivo(s).
- `src/components/auth/SubmitButton.tsx` — 🔴 Alto — usado por 3 arquivo(s).
- `src/lib/access-client.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/lib/access-control.ts` — 🔴 Alto — usado por 6 arquivo(s).
- `src/lib/access-cta.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/lib/access/access-helpers.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/lib/access/applySignupTokenAccess.ts` — 🔴 Alto — usado por 4 arquivo(s).
- `src/lib/access/getCurrentUserAccess.ts` — 🔴 Alto — usado por 6 arquivo(s).
- `src/lib/access/reconcileUserAccessSnapshot.ts` — 🔴 Alto — usado por 5 arquivo(s).
- `src/lib/access/resolveUserAccess.ts` — 🔴 Alto — usado por 8 arquivo(s).

### Essencial / Estratégico compartilhado

- `src/app/api/admin/audit-access/fix/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/admin/audit-access/inconsistencies/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/admin/audit-access/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/admin/reset-user-password/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/chat/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/export-xlsx/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/kiwify/webhook/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/nexus-admin/organizations/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/pdf/ask/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/pdf/detach/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/pdf/index/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/pdf/reprocess/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/public/share/[shareId]/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/public/share/create/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/upload-pdf/route.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/api/upload-pdf/upload-pdf-route - Copia.ts` — 🔴 Alto — usado por 0 arquivo(s).
- `src/app/chat/ChatPageClient.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/chat/components/ChatEmptyState.tsx` — 🔴 Alto — usado por 2 arquivo(s).
- `src/app/chat/components/ChatInput.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/chat/components/ChatMessagesList.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/chat/components/ChatSidebar.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/chat/theme.ts` — 🔴 Alto — usado por 5 arquivo(s).
- `src/app/chat/utils/alertStyles.ts` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/nexus-admin/organizacoes/NexusOrganizationsClient.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/app/p/[shareId]/SharedConversationClient.tsx` — 🔴 Alto — usado por 1 arquivo(s).
- `src/lib/copy/copyMessageToClipboard.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/lib/publiaPrompt.ts` — 🔴 Alto — usado por 2 arquivo(s).
- `src/lib/webFirstDetector.ts` — 🔴 Alto — usado por 1 arquivo(s).
- `src/types/access.ts` — 🔴 Alto — usado por 6 arquivo(s).

### Governança

- `src/app/api/governance/audit-logs/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/auth/login/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/chat/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/conversations/[conversationId]/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/conversations/conversations-route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/conversations/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/indicators/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/institutional-documents/route.backup-v8-5.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/institutional-documents/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/messages/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/official-gazette-chunks/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/official-gazette-documents/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/official-gazette/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/official-sources/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/api/governance/users/route.ts` — 🟡 Médio — usado por 0 arquivo(s).
- `src/app/governanca/GovernanceShell.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/auditoria/AuditLogsClient.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/base-institucional/InstitutionalDocumentsClient.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/chat/GovernanceChatClient.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/components/GovernanceHeader.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/components/GovernanceSidebar.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/conversas/GovernanceConversationsClient.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/conversas/[conversationId]/GovernanceConversationDetailClient.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/diario-oficial/OfficialGazetteClient.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/fontes-oficiais/OfficialSourcesClient.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/indicadores/IndicatorsClient.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/login/GovernanceLoginForm.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/usuarios/GovernanceUserActions.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/app/governanca/usuarios/NewGovernanceUserForm.tsx` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/lib/governance/get-current-organization.ts` — 🔴 Alto — usado por 24 arquivo(s).
- `src/lib/governanceCriticalKnowledge.ts` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/lib/governanceLegalGuardrails.ts` — 🟢 Baixo — usado por 1 arquivo(s).
- `src/types/governance.ts` — 🔴 Alto — usado por 27 arquivo(s).

---

## Pontos de blindagem inicial

Antes de alterar qualquer item abaixo, registrar análise de impacto:

- `src/types/access.ts`
- `src/lib/copy/copyMessageToClipboard.ts`
- `src/lib/publiaPrompt.ts`
- `src/app/nexus-admin/organizacoes/NexusOrganizationsClient.tsx`
- `src/app/p/[shareId]/SharedConversationClient.tsx`
- `src/lib/webFirstDetector.ts`
- `src/app/api/admin/audit-access/fix/route.ts`
- `src/app/api/admin/audit-access/inconsistencies/route.ts`
- `src/app/api/admin/audit-access/route.ts`
- `src/app/api/admin/reset-user-password/route.ts`
- `src/app/api/export-xlsx/route.ts`
- `src/app/api/kiwify/webhook/route.ts`
- `src/app/api/nexus-admin/organizations/route.ts`
- `src/app/api/public/share/[shareId]/route.ts`
- `src/app/api/public/share/create/route.ts`
- `src/app/atualizar-senha/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `src/app/layout.tsx`
- `src/app/logout/route.ts`
- `src/app/nexus-admin/layout.tsx`
- `src/app/nexus-admin/organizacoes/page.tsx`
- `src/app/nexus-admin/page.tsx`
- `src/app/p/[shareId]/page.tsx`

---

## Recomendações

1. Não alterar rotas compartilhadas de Chat/PDF sem verificar Essencial e Estratégico.
2. Não alterar `src/lib/supabase/*` sem testar autenticação, chat, upload e governança.
3. Manter Governança preferencialmente em `src/app/api/governance/*`, `src/lib/governance/*` e telas próprias.
4. Para novas funcionalidades, preferir arquivos de domínio específico antes de tocar no Core.
5. Após qualquer alteração em arquivo 🔴, rodar `npm run build` e testar o fluxo afetado.

---

## Próximo passo

Produzir `10-FLUXO-CORE.md` com base nos arquivos Core e pontos de dependência identificados nesta matriz.
