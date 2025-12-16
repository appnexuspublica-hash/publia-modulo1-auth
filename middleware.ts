import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function clearSupabaseCookies(req: NextRequest, res: NextResponse) {
  // remove cookies do Supabase (varia por projeto, mas quase sempre começa com "sb-")
  for (const c of req.cookies.getAll()) {
    if (c.name.startsWith("sb-")) {
      res.cookies.set({
        name: c.name,
        value: "",
        path: "/",
        maxAge: 0,
      });
    }
  }
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const res = NextResponse.next();

  // ----------------------------------------------------
  // 1) Mantém sua regra de bloqueio do /criar-conta
  // ----------------------------------------------------
  if (url.pathname === "/criar-conta") {
    const expected = (process.env.SIGNUP_TOKEN || "").trim();
    if (expected) {
      const tk = (url.searchParams.get("tk") || "").trim();
      const isValid = tk === expected;

      if (!isValid) {
        const redirectTo = (
          process.env.REDIRECT_BLOCKED_SIGNUP || "https://nexuspublica.com.br/"
        ).trim();

        return NextResponse.redirect(redirectTo);
      }
    }
  }

  // ----------------------------------------------------
  // 2) Supabase SSR: tenta ler usuário e atualizar cookies
  //    - se não existir refresh token, limpa cookies e segue
  // ----------------------------------------------------
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name) {
        return req.cookies.get(name)?.value;
      },
      set(name, value, options) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const { error } = await supabase.auth.getUser();

  // ✅ este é o erro que você está vendo no Vercel
  if (error?.code === "refresh_token_not_found") {
    clearSupabaseCookies(req, res);
    return res;
  }

  // (opcional) logar outros erros (sem quebrar)
  if (error) {
    console.error("[middleware] supabase auth error:", error);
  }

  return res;
}

export const config = {
  // roda em /login, /chat e /criar-conta (sem afetar assets do Next)
  matcher: ["/login", "/chat/:path*", "/criar-conta"],
};
