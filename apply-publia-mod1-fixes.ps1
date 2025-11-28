param(
  [switch]$CleanDist
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) {
  Write-Host "[PubliaMod1] $msg" -ForegroundColor Cyan
}

function Set-FileUtf8($path, $content) {
  $dir = Split-Path $path
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $encoding)
}

Write-Info "Applying fixes for Publia Module 1..."

# 1) Corrigir loginActions.ts (LoginState + actionLoginCpfCnpj)
$loginActionsPath = "src/app/(auth)/login/loginActions.ts"
$loginActionsContent = @'
"use server";

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { onlyDigits } from "../../../lib/validators";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function pub() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon);
}

export type LoginState = {
  ok?: boolean;
  error?: string;
  redirect?: string;
};

const schema = z.object({
  cpf_cnpj: z
    .string()
    .transform((v) => onlyDigits(v))
    .refine((d) => /^\d+$/.test(d), "Informe apenas numeros")
    .refine(
      (d) => d.length === 11 || d.length === 14,
      "Informe CPF (11) ou CNPJ (14)"
    ),
  senha: z.string().min(1, "Informe sua senha"),
});

export async function actionLoginCpfCnpj(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    const raw = Object.fromEntries(formData.entries());
    const { cpf_cnpj, senha } = schema.parse(raw);

    const adm = admin();
    const { data: prof, error: e1 } = await adm
      .from("profiles")
      .select("email")
      .eq("cpf_cnpj", cpf_cnpj)
      .maybeSingle();

    if (e1) return { ok: false, error: "Falha ao consultar cadastro." };
    if (!prof?.email)
      return { ok: false, error: "CPF/CNPJ nao encontrado." };

    const client = pub();
    const { error: e2 } = await client.auth.signInWithPassword({
      email: prof.email,
      password: senha,
    });

    if (e2) return { ok: false, error: "Credenciais invalidas." };

    return { ok: true, redirect: "/chat" };
  } catch (e: any) {
    const zIssue = e?.issues?.[0]?.message;
    return { ok: false, error: zIssue || "Nao foi possivel entrar agora." };
  }
}
'@
Set-FileUtf8 $loginActionsPath $loginActionsContent
Write-Info "Updated $loginActionsPath"

# 2) Deixar page.tsx do login bem simples: só renderiza LoginForm
$loginPagePath = "src/app/(auth)/login/page.tsx"
$loginPageContent = @'
"use client";

import LoginForm from "./LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
'@
Set-FileUtf8 $loginPagePath $loginPageContent
Write-Info "Updated $loginPagePath"

# 3) Página /criar-conta com redirect por token (server component)
$signupPagePath = "src/app/(auth)/criar-conta/page.tsx"
$signupPageContent = @'
import { redirect } from "next/navigation";
import SignupForm from "./SignupForm";

const SIGNUP_TOKEN = process.env.SIGNUP_TOKEN;
const BLOCKED_REDIRECT =
  process.env.REDIRECT_BLOCKED_SIGNUP ?? "https://nexuspublica.com.br/";

type PageProps = {
  searchParams: { tk?: string };
};

export default function SignupPage({ searchParams }: PageProps) {
  const token = searchParams?.tk ?? "";
  const tokenOk = !!SIGNUP_TOKEN && token === SIGNUP_TOKEN;

  if (!tokenOk) {
    redirect(BLOCKED_REDIRECT);
  }

  return <SignupForm />;
}
'@
Set-FileUtf8 $signupPagePath $signupPageContent
Write-Info "Updated $signupPagePath"

# 4) Garantir que SignupForm.tsx envia o tk escondido
$signupFormPath = "src/app/(auth)/criar-conta/SignupForm.tsx"
if (Test-Path $signupFormPath) {
  $sf = Get-Content $signupFormPath -Raw

  # garantir const tk usando useSearchParams
  if ($sf -match "useSearchParams" -and $sf -notmatch "const tk =") {
    $sf = $sf -replace "const search = useSearchParams\(\);", "const search = useSearchParams();`r`n  const tk = search.get(""tk"") ?? """";"
  }

  # adicionar input hidden tk se ainda nao existir
  if ($sf -notmatch "name=""tk""") {
    $pattern = "(<form[^>]*>)"
    $replacement = '$1' + "`r`n      <input type=""hidden"" name=""tk"" value={tk} />"
    $sf = [System.Text.RegularExpressions.Regex]::Replace(
      $sf,
      $pattern,
      $replacement,
      1
    )
    Write-Info "Injected hidden tk input into SignupForm.tsx"
  }

  Set-FileUtf8 $signupFormPath $sf
  Write-Info "Updated $signupFormPath"
}
else {
  Write-Info "SignupForm.tsx not found, skipping tk patch."
}

# 5) Corrigir RootLayout (classes quebradas + tipagem children)
$layoutPath = "src/app/layout.tsx"
$layoutContent = @'
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Publ.IA - Auth",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="min-h-screen flex items-center justify-center p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
'@
Set-FileUtf8 $layoutPath $layoutContent
Write-Info "Updated $layoutPath"

# 6) test-env.ts como helper de dev (sem logar a key inteira)
$testEnvPath = "test-env.ts"
if (Test-Path $testEnvPath) {
  $testEnvContent = @'
/**
 * Dev helper only.
 * Run with: node -r dotenv/config test-env.ts
 * Do not import this file from the app.
 */
console.log(
  "SUPABASE_SERVICE_ROLE_KEY length =",
  (process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0)
);
'@
  Set-FileUtf8 $testEnvPath $testEnvContent
  Write-Info "Updated $testEnvPath"
}

# 7) Opcional: limpar para zipar
if ($CleanDist) {
  Write-Info "Cleaning build artifacts (.next, node_modules, backups)..."

  $patterns = @(".next", "node_modules", ".backup-auth-fix-*", ".backup-auth-ui-*")
  foreach ($pat in $patterns) {
    Get-ChildItem -Path $pat -ErrorAction SilentlyContinue | ForEach-Object {
      Write-Info ("Removing " + $_.FullName)
      Remove-Item -Recurse -Force $_.FullName
    }
  }

  Write-Info "Env files (.env, .env.local) were NOT removed. Delete manually if needed."
}

Write-Info "All Publia Module 1 fixes applied."
