// src/lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient<any, "public", any>;

export function createSupabaseAdminClient(): AdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !url.startsWith("http")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL inválida. Confira seu .env.local");
  }
  if (!service) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente. Confira seu .env.local");
  }

  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
