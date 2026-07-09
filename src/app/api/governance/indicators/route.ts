// src/app/api/governance/indicators/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getCurrentGovernanceOrganization } from "@/lib/governance/get-current-organization";

function createWritableSupabaseRouteClient() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

async function countRows(
  supabase: ReturnType<typeof createWritableSupabaseRouteClient>,
  table: string,
  organizationId: string,
  extra?: (query: any) => any,
) {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (extra) {
    query = extra(query);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function GET() {
  try {
    const supabase = createWritableSupabaseRouteClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      );
    }

    const context = await getCurrentGovernanceOrganization(user.id);

    if (!context) {
      return NextResponse.json(
        { error: "Usuário não vinculado a uma organização ativa." },
        { status: 403 },
      );
    }

    const allowedTechnicalRoles = ["owner", "admin", "manager"];

    if (!allowedTechnicalRoles.includes(context.membership.technical_role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode consultar Indicadores." },
        { status: 403 },
      );
    }

    const organizationId = context.organization.id;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      membersTotal,
      membersActive,
      membersSuspended,
      conversationsTotal,
      conversationsActive,
      messagesTotal,
      documentsTotal,
      documentsIndexed,
      documentsPendingIndexing,
      sourcesTotal,
      sourcesActive,
      gazettesTotal,
      gazettesActive,
      gazetteDocumentsTotal,
      auditEventsTotal,
      auditEventsLast30Days,
    ] = await Promise.all([
      countRows(supabase, "organization_members", organizationId),
      countRows(supabase, "organization_members", organizationId, (query) =>
        query.eq("status", "active"),
      ),
      countRows(supabase, "organization_members", organizationId, (query) =>
        query.eq("status", "suspended"),
      ),
      countRows(supabase, "governance_conversations", organizationId),
      countRows(supabase, "governance_conversations", organizationId, (query) =>
        query.eq("status", "active"),
      ),
      countRows(supabase, "governance_messages", organizationId),
      countRows(supabase, "institutional_documents", organizationId),
      countRows(supabase, "institutional_documents", organizationId, (query) =>
        query.eq("indexing_status", "indexed"),
      ),
      countRows(supabase, "institutional_documents", organizationId, (query) =>
        query.in("indexing_status", ["not_indexed", "pending", "processing"]),
      ),
      countRows(supabase, "official_sources", organizationId),
      countRows(supabase, "official_sources", organizationId, (query) =>
        query.eq("status", "active"),
      ),
      countRows(supabase, "governance_official_gazettes", organizationId),
      countRows(supabase, "governance_official_gazettes", organizationId, (query) =>
        query.eq("active", true),
      ),
      countRows(supabase, "governance_official_gazette_documents", organizationId),
      countRows(supabase, "organization_audit_logs", organizationId),
      countRows(supabase, "organization_audit_logs", organizationId, (query) =>
        query.gte("created_at", thirtyDaysAgo.toISOString()),
      ),
    ]);

    return NextResponse.json({
      indicators: {
        organization: {
          id: context.organization.id,
          name: context.organization.name,
          seats_limit: context.organization.seats_limit,
        },
        users: {
          total: membersTotal,
          active: membersActive,
          suspended: membersSuspended,
          seats_limit: context.organization.seats_limit,
          seats_used: membersActive,
        },
        chat: {
          conversations_total: conversationsTotal,
          conversations_active: conversationsActive,
          messages_total: messagesTotal,
        },
        institutional_documents: {
          total: documentsTotal,
          indexed: documentsIndexed,
          pending_indexing: documentsPendingIndexing,
        },
        official_sources: {
          total: sourcesTotal,
          active: sourcesActive,
        },
        official_gazette: {
          total: gazettesTotal,
          active: gazettesActive,
          documents_total: gazetteDocumentsTotal,
        },
        audit: {
          events_total: auditEventsTotal,
          events_last_30_days: auditEventsLast30Days,
        },
      },
    });
  } catch (error) {
    console.error(
      "[governance] Erro inesperado ao carregar indicadores:",
      error,
    );

    return NextResponse.json(
      { error: "Erro inesperado ao carregar indicadores." },
      { status: 500 },
    );
  }
}
