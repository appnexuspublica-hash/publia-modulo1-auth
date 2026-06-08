// src/lib/supabase/client.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} ausente. Confira as variáveis de ambiente.`);
  }

  return value;
}

export function createSupabaseBrowserClient() {
  const supabaseUrl = getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

  const supabaseAnonKey = getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Compatibilidade com partes antigas do projeto que importam supabaseClient diretamente.
export const supabaseClient = createSupabaseBrowserClient();
