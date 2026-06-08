import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

function isGovernancePublicRoute(pathname: string) {
  return pathname === "/governanca/login";
}

function redirectWithCookies(
  req: NextRequest,
  pathname: string,
  sourceResponse: NextResponse,
) {
  const redirectResponse = NextResponse.redirect(new URL(pathname, req.url));

  for (const cookie of sourceResponse.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const res = NextResponse.next({
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
      get(name) {
        return req.cookies.get(name)?.value;
      },
      set(name, value, options) {
        req.cookies.set({ name, value, ...options });
        res.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        req.cookies.set({ name, value: "", ...options });
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error?.name === "AuthSessionMissingError") {
    if (pathname.startsWith("/governanca")) {
      return redirectWithCookies(req, "/governanca/login", res);
    }

    return res;
  }

  if (error?.code === "refresh_token_not_found") {
    clearSupabaseCookies(req, res);

    if (pathname.startsWith("/governanca")) {
      return redirectWithCookies(req, "/governanca/login", res);
    }

    return res;
  }

  if (error) {
    console.error("[middleware] supabase auth error:", error);
  }

  if (pathname.startsWith("/governanca")) {
    if (!user) {
      return redirectWithCookies(req, "/governanca/login", res);
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

      return redirectWithCookies(req, "/governanca/login", res);
    }

    if (!membership?.organization_id) {
      return redirectWithCookies(req, "/governanca/login", res);
    }
  }

  return res;
}

export const config = {
  matcher: ["/login", "/chat/:path*", "/governanca/:path*"],
};
