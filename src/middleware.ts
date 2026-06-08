// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function isGovernancePublicRoute(pathname: string) {
  return pathname === "/governanca/login";
}

function isGovernanceRoute(pathname: string) {
  return pathname.startsWith("/governanca");
}

function copyResponseCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }

  return to;
}

function redirectWithCookies(req: NextRequest, res: NextResponse, pathname: string) {
  const redirectResponse = NextResponse.redirect(new URL(pathname, req.url));
  return copyResponseCookies(res, redirectResponse);
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

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  // A página de login institucional precisa ficar pública.
  // Se ela for protegida, o app entra em loop de redirect.
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
        cookiesToSet.forEach(({ name, value }) => {
          req.cookies.set(name, value);
        });

        res = NextResponse.next({
          request: {
            headers: req.headers,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          const cookieOptions: CookieOptions = {
            ...options,
            path: options?.path ?? "/",
            sameSite: options?.sameSite ?? "lax",
            secure: process.env.NODE_ENV === "production",
          };

          res.cookies.set(name, value, cookieOptions);
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error?.name === "AuthSessionMissingError") {
    if (isGovernanceRoute(pathname)) {
      return redirectWithCookies(req, res, "/governanca/login");
    }

    return res;
  }

  if (error?.code === "refresh_token_not_found") {
    clearSupabaseCookies(req, res);

    if (isGovernanceRoute(pathname)) {
      return redirectWithCookies(req, res, "/governanca/login");
    }

    return res;
  }

  if (error) {
    console.error("[middleware] supabase auth error:", error);
  }

  if (isGovernanceRoute(pathname)) {
    if (!user) {
      return redirectWithCookies(req, res, "/governanca/login");
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("id, status, organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error("[middleware] governance membership error:", membershipError);
      return redirectWithCookies(req, res, "/governanca/login");
    }

    if (!membership?.organization_id) {
      return redirectWithCookies(req, res, "/governanca/login");
    }
  }

  return res;
}

export const config = {
  matcher: ["/login", "/chat/:path*", "/governanca/:path*"],
};
