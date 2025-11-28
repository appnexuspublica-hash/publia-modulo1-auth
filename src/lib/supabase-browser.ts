// src/lib/supabase-browser.ts
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!url) console.warn("[supabase-browser] NEXT_PUBLIC_SUPABASE_URL ausente");
if (!anon) console.warn("[supabase-browser] NEXT_PUBLIC_SUPABASE_ANON_KEY ausente");
export const supabaseBrowser = () => createClient(url, anon, { auth: { persistSession: true } });

