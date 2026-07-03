//src/lib/products/product-mode.ts
export type ProductMode = "essential" | "strategic" | "governance";

/**
 * REGRA DE PRODUTO:
 *
 * essential:
 * - Chat individual
 * - Usa conversations, messages e pdf_files
 * - NÃO exige organization_id
 *
 * strategic:
 * - Chat individual avançado
 * - Usa conversations, messages e pdf_files
 * - NÃO exige organization_id
 *
 * governance:
 * - Chat institucional/organizacional
 * - Usa tabelas governance_*
 * - EXIGE organização ativa
 */
export const PRODUCT_RULES = {
  essential: {
    requiresOrganization: false,
    chatRoute: "/api/chat",
  },
  strategic: {
    requiresOrganization: false,
    chatRoute: "/api/chat",
  },
  governance: {
    requiresOrganization: true,
    chatRoute: "/api/governance/chat",
  },
} as const;