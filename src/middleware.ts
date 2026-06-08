// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function copyResponseCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

function clearSupabaseCookies(req: NextRequest, res: NextResponse) {
  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      res.cookies.set({
        name: cookie.name,
        value: "",
        path: "/",
        maxAge: 0,
      });
    }
  }
}

function redirectToLogin(req: NextRequest, sourceResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(new URL("/login", req.url));
  copyResponseCookies(sourceResponse, redirectResponse);
  return redirectResponse;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  /*
    Importante:
    O Governança foi removido do middleware.

    Motivo:
    Em produção, o log da Vercel mostrou que o redirect 307 para
    /governanca/login estava saindo do middleware antes da página abrir.

    A proteção do Governança deve ficar nas próprias páginas e route handlers,
    onde o Supabase SSR consegue ler a sessão no contexto correto da requisição.
  */

  const shouldProtectDefaultChat = pathname.startsWith("/chat");

  if (!shouldProtectDefaultChat) {
    return res;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[middleware] Variáveis do Supabase não configuradas.");
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          req.cookies.set(name, value);
        }

        res = NextResponse.next({
          request: {
            headers: req.headers,
          },
        });

        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error?.code === "refresh_token_not_found") {
    clearSupabaseCookies(req, res);
    return redirectToLogin(req, res);
  }

  if (error?.name === "AuthSessionMissingError") {
    return redirectToLogin(req, res);
  }

  if (error) {
    console.error("[middleware] supabase auth error:", error);
  }

  if (!user) {
    return redirectToLogin(req, res);
  }

  return res;
}

export const config = {
  matcher: ["/chat/:path*"],
};
