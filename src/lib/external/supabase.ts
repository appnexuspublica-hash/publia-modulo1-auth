// src/lib/external/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient<any, "public", any>;

export function createAdminClient(): AdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !url.startsWith("http")) {
    throw new Error("Configuração NEXT_PUBLIC_SUPABASE_URL inválida ou ausente.");
  }
  if (!service) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
  }

  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
