// src/app/estrategico/chat/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import StrategicChatPageClient from "./StrategicChatPageClient";
import { getCurrentUserAccess } from "@/lib/access/getCurrentUserAccess";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function StrategicChatPage() {
  const cookieStore = cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(_name: string, _value: string, _options: any) {
        // No-op em Server Component.
      },
      remove(_name: string, _options: any) {
        // No-op em Server Component.
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // /estrategico/chat é exclusivo do Publ.IA Estratégico.
  // O redirect precisa ficar fora do try/catch porque o Next.js o implementa
  // lançando internamente a exceção NEXT_REDIRECT.
  let effectiveProductTier: "essential" | "strategic" | null = null;

  try {
    const { resolved } = await getCurrentUserAccess(supabase);
    effectiveProductTier = resolved.effectiveProductTier;
  } catch (accessError) {
    console.error("[estrategico/chat/page] Erro ao resolver produto do usuário:", accessError);
  }

  if (effectiveProductTier === "essential") {
    redirect("/essencial/chat");
  }

  let userCpfCnpj: string | null = null;

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("cpf_cnpj")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profileError && profile?.cpf_cnpj) {
      userCpfCnpj = profile.cpf_cnpj;
    }
  } catch (profileError) {
    console.error("[estrategico/chat/page] Erro ao buscar profile:", profileError);
  }

  const userLabel = userCpfCnpj || "[ usuário ]";

  return <StrategicChatPageClient userId={user.id} userLabel={userLabel} />;
}
