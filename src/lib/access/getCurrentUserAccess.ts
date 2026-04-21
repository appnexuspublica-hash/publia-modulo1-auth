//src/lib/access/getCurrentUserAccess.ts

import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  resolveUserAccess,
  type ResolvedUserAccess,
  type UserAccessGrantRow,
  type UserAccessRow,
} from "@/lib/access/resolveUserAccess";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type UserAccessGrantDbRow = {
  id: string;
  user_id: string;
  product_tier: string;
  grant_kind: string;
  status: string;
  source: string;
  source_token_id: string | null;
  subscription_plan: string | null;
  started_at: string;
  ends_at: string | null;
  activated_at: string;
  consumed_at: string | null;
  canceled_at: string | null;
  origin_grant_id: string | null;
  fallback_product_tier: string | null;
  fallback_reference: string | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
};

export type CurrentUserAccessResult = {
  user: User | null;
  resolved: ResolvedUserAccess;
  snapshot: UserAccessRow | null;
  grants: UserAccessGrantRow[];
};

export async function getCurrentUserAccess(
  supabase: SupabaseClient,
): Promise<CurrentUserAccessResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(
      `Erro ao obter usuário autenticado: ${authError.message}`,
    );
  }

  if (!user) {
    return {
      user: null,
      resolved: resolveUserAccess({
        snapshot: null,
        grants: [],
      }),
      snapshot: null,
      grants: [],
    };
  }

  const [snapshotResult, grantsResult] = await Promise.all([
    supabase
      .from("user_access")
      .select(
        `
          id,
          user_id,
          access_status,
          trial_started_at,
          trial_ends_at,
          trial_message_limit,
          subscription_plan,
          subscription_started_at,
          subscription_ends_at,
          created_at,
          updated_at,
          product_tier
        `,
      )
      .eq("user_id", user.id)
      .maybeSingle<UserAccessRow>(),

    supabase
      .from("user_access_grants")
      .select(
        `
          id,
          user_id,
          product_tier,
          grant_kind,
          status,
          source,
          source_token_id,
          subscription_plan,
          started_at,
          ends_at,
          activated_at,
          consumed_at,
          canceled_at,
          origin_grant_id,
          fallback_product_tier,
          fallback_reference,
          metadata,
          created_at,
          updated_at
        `,
      )
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .returns<UserAccessGrantDbRow[]>(),
  ]);

  if (snapshotResult.error) {
    throw new Error(
      `Erro ao buscar snapshot de acesso do usuário: ${snapshotResult.error.message}`,
    );
  }

  if (grantsResult.error) {
    throw new Error(
      `Erro ao buscar histórico de acesso do usuário: ${grantsResult.error.message}`,
    );
  }

  const snapshot = snapshotResult.data ?? null;

  const grants: UserAccessGrantRow[] = (grantsResult.data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    product_tier: row.product_tier,
    grant_kind: row.grant_kind,
    status: row.status,
    source: row.source,
    source_token_id: row.source_token_id,
    subscription_plan: row.subscription_plan,
    started_at: row.started_at,
    ends_at: row.ends_at,
    activated_at: row.activated_at,
    consumed_at: row.consumed_at,
    canceled_at: row.canceled_at,
    origin_grant_id: row.origin_grant_id,
    fallback_product_tier: row.fallback_product_tier,
    fallback_reference: row.fallback_reference,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const resolved = resolveUserAccess({
    snapshot,
    grants,
  });

  return {
    user,
    resolved,
    snapshot,
    grants,
  };
}

export async function getCurrentUserAccessByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<Omit<CurrentUserAccessResult, "user">> {
  if (!userId) {
    throw new Error("userId é obrigatório para buscar acesso do usuário.");
  }

  const [snapshotResult, grantsResult] = await Promise.all([
    supabase
      .from("user_access")
      .select(
        `
          id,
          user_id,
          access_status,
          trial_started_at,
          trial_ends_at,
          trial_message_limit,
          subscription_plan,
          subscription_started_at,
          subscription_ends_at,
          created_at,
          updated_at,
          product_tier
        `,
      )
      .eq("user_id", userId)
      .maybeSingle<UserAccessRow>(),

    supabase
      .from("user_access_grants")
      .select(
        `
          id,
          user_id,
          product_tier,
          grant_kind,
          status,
          source,
          source_token_id,
          subscription_plan,
          started_at,
          ends_at,
          activated_at,
          consumed_at,
          canceled_at,
          origin_grant_id,
          fallback_product_tier,
          fallback_reference,
          metadata,
          created_at,
          updated_at
        `,
      )
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .returns<UserAccessGrantDbRow[]>(),
  ]);

  if (snapshotResult.error) {
    throw new Error(
      `Erro ao buscar snapshot de acesso do usuário: ${snapshotResult.error.message}`,
    );
  }

  if (grantsResult.error) {
    throw new Error(
      `Erro ao buscar histórico de acesso do usuário: ${grantsResult.error.message}`,
    );
  }

  const snapshot = snapshotResult.data ?? null;

  const grants: UserAccessGrantRow[] = (grantsResult.data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    product_tier: row.product_tier,
    grant_kind: row.grant_kind,
    status: row.status,
    source: row.source,
    source_token_id: row.source_token_id,
    subscription_plan: row.subscription_plan,
    started_at: row.started_at,
    ends_at: row.ends_at,
    activated_at: row.activated_at,
    consumed_at: row.consumed_at,
    canceled_at: row.canceled_at,
    origin_grant_id: row.origin_grant_id,
    fallback_product_tier: row.fallback_product_tier,
    fallback_reference: row.fallback_reference,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const resolved = resolveUserAccess({
    snapshot,
    grants,
  });

  return {
    resolved,
    snapshot,
    grants,
  };
}