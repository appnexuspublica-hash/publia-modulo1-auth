"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createSupabaseBrowserClient() {
  return createClient(url, anon, {
    auth: { persistSession: true },
  });
}

// compat: caso algum lugar use supabaseClient diretamente
export const supabaseClient = createSupabaseBrowserClient();
