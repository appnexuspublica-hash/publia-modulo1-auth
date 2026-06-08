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

function redirectToGovernanceLogin(req: NextRequest, sourceResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(
    new URL("/governanca/login", req.url),
  );

  copyResponseCookies(sourceResponse, redirectResponse);

  return redirectResponse;
}

function isGovernancePublicRoute(pathname: string) {
  return pathname === "/governanca/login";
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  // A página de login institucional precisa ficar pública.
  // Se ela for protegida, o app entra em loop de 307.
  if (isGovernancePublicRoute(pathname)) {
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

  if (error?.name === "AuthSessionMissingError") {
    if (pathname.startsWith("/governanca")) {
      return redirectToGovernanceLogin(req, res);
    }

    return res;
  }

  if (error?.code === "refresh_token_not_found") {
    clearSupabaseCookies(req, res);

    if (pathname.startsWith("/governanca")) {
      return redirectToGovernanceLogin(req, res);
    }

    return res;
  }

  if (error) {
    console.error("[middleware] supabase auth error:", error);
  }

  if (pathname.startsWith("/governanca") && !user) {
    return redirectToGovernanceLogin(req, res);
  }

  /*
    Importante:
    O middleware roda no Edge Runtime e deve validar apenas a sessão.
    A validação de vínculo institucional em organization_members fica nas páginas
    e nos route handlers do Governança.

    Motivo:
    Validar organization_members aqui pode gerar falso redirect em produção,
    especialmente em navegações RSC/prefetch como /governanca/chat?_rsc=...
    O log da Vercel mostrou que o 307 estava saindo do middleware antes da página abrir.
  */

  return res;
}

export const config = {
  matcher: ["/login", "/chat/:path*", "/governanca/:path*"],
};
