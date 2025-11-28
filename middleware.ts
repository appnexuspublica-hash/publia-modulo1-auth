import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Só queremos vigiar a rota /criar-conta
  if (url.pathname === "/criar-conta") {
    const expected = (process.env.SIGNUP_TOKEN || "").trim();
    // Se não tiver token configurado, deixa passar (evita travar dev por engano)
    if (!expected) {
      return NextResponse.next();
    }

    const tk = (url.searchParams.get("tk") || "").trim();
    const isValid = tk === expected;

    if (!isValid) {
      const redirectTo =
        (process.env.REDIRECT_BLOCKED_SIGNUP || "https://nexuspublica.com.br/").trim();

      return NextResponse.redirect(redirectTo);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/criar-conta"],
};
