// src/app/chat/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import ChatPageClient from "./ChatPageClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function ChatPage() {
  const cookieStore = cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        // aqui podemos LER normalmente
        return cookieStore.get(name)?.value;
      },
      // No /chat não podemos modificar cookies (Next 14 não permite em Server Components),
      // então transformamos set/remove em "no-op" (não faz nada).
      set(_name: string, _value: string, _options: any) {
        // intencionalmente vazio
      },
      remove(_name: string, _options: any) {
        // intencionalmente vazio
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return redirect("/login");
  }

  // Buscar CPF/CNPJ a partir de profiles.user_id
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
  } catch (e) {
    console.error("[chat/page] Erro ao buscar profile:", e);
  }

  const userLabel = userCpfCnpj || "[ usuário ]";

  return (
    <ChatPageClient
      userId={user.id}
      userLabel={userLabel}
    />
  );
}
