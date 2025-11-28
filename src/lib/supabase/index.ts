// src/lib/supabase/index.ts

export { supabaseClient } from "./client";
// Caso você precise de um client admin (service role) reutilizável no futuro,
// aí a gente cria e exporta "supabaseAdmin" a partir de ./server.
// No momento, ninguém está usando esse export.
