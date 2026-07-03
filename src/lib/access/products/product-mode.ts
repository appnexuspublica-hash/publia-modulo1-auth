// src/lib/access/products/product-mode.ts

export type ProductMode = "essential" | "strategic" | "governance";

export type ChatScope = "individual" | "organization";

/**
 * CONTRATO DE PRODUTO DO PUBL.IA
 *
 * Essencial:
 * - Chat individual
 * - Usa conversations, messages e pdf_files
 * - Isolamento por user_id
 * - NÃO exige organização
 *
 * Estratégico:
 * - Chat individual avançado
 * - Usa conversations, messages e pdf_files
 * - Isolamento por user_id
 * - NÃO exige organização
 *
 * Governança:
 * - Chat organizacional/institucional
 * - Usa tabelas governance_*
 * - Isolamento por organization_id
 * - EXIGE organização ativa
 */
export const PRODUCT_RULES = {
  essential: {
    scope: "individual",
    requiresOrganization: false,
    chatRoute: "/api/chat",
    appRoute: "/chat",
  },
  strategic: {
    scope: "individual",
    requiresOrganization: false,
    chatRoute: "/api/chat",
    appRoute: "/chat",
  },
  governance: {
    scope: "organization",
    requiresOrganization: true,
    chatRoute: "/api/governance/chat",
    appRoute: "/governanca/chat",
  },
} as const satisfies Record<
  ProductMode,
  {
    scope: ChatScope;
    requiresOrganization: boolean;
    chatRoute: string;
    appRoute: string;
  }
>;

export function getProductRule(mode: ProductMode) {
  return PRODUCT_RULES[mode];
}

export function requiresOrganization(mode: ProductMode) {
  return PRODUCT_RULES[mode].requiresOrganization;
}

export function isIndividualProduct(mode: ProductMode) {
  return PRODUCT_RULES[mode].scope === "individual";
}

export function isGovernanceProduct(mode: ProductMode) {
  return PRODUCT_RULES[mode].scope === "organization";
}

export function getChatRouteForProduct(mode: ProductMode) {
  return PRODUCT_RULES[mode].chatRoute;
}
