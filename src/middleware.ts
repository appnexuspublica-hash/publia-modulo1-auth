// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function redirectToLogin(req: NextRequest) {
  return NextResponse.redirect(new URL("/login", req.url));
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const protectedIndividualRoutes = ["/chat", "/essencial/chat", "/estrategico/chat"];
  const isProtectedIndividualRoute = protectedIndividualRoutes.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!isProtectedIndividualRoute) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          req.cookies.set(name, value);
        });

        response = NextResponse.next({
          request: {
            headers: req.headers,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToLogin(req);
  }

  return response;
}

export const config = {
  matcher: ["/chat/:path*", "/essencial/chat/:path*", "/estrategico/chat/:path*"],
};
