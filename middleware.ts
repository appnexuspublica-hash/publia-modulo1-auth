import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function clearSupabaseCookies(req: NextRequest, res: NextResponse) {
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

  // 1) Bloqueio do /criar-conta (modo convites)
  if (url.pathname.startsWith("/criar-conta")) {
    const enabled = (process.env.INVITES_ENABLED ?? "1").trim() !== "0";
    if (enabled) {
      const tk = (url.searchParams.get("tk") || "").trim();

      if (!tk) {
        const redirectTo = (
          process.env.REDIRECT_BLOCKED_SIGNUP || "/login"
        ).trim();

        return NextResponse.redirect(new URL(redirectTo, req.url));
      }
    }
  }

  // 2) Supabase SSR: tenta ler usuário e atualizar cookies
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

  if (error?.code === "refresh_token_not_found") {
    clearSupabaseCookies(req, res);
    return res;
  }

  if (error) {
    console.error("[middleware] supabase auth error:", error);
  }

  return res;
}

export const config = {
  matcher: ["/login", "/chat/:path*", "/criar-conta/:path*"],
};
