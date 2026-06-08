import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type CookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none" | boolean;
  secure?: boolean;
};

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL inválida. Confira as variáveis de ambiente.");
  }

  if (!supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY ausente. Confira as variáveis de ambiente.");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({
            name,
            value,
            ...options,
            path: options?.path ?? "/",
            sameSite: options?.sameSite ?? "lax",
            secure: options?.secure ?? process.env.NODE_ENV === "production",
          });
        } catch {
          // Pode ocorrer em Server Components. Nesses casos, o middleware fica responsável
          // por atualizar a sessão/cookies quando necessário.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({
            name,
            value: "",
            ...options,
            path: options?.path ?? "/",
            maxAge: 0,
          });
        } catch {
          // Pode ocorrer em Server Components. Nesses casos, o middleware fica responsável
          // por atualizar a sessão/cookies quando necessário.
        }
      },
    },
  });
}
