# publia-auth-fix-pack-v2

Este pacote substitui/insere arquivos para estabilizar a autenticação (Supabase) no projeto **publia-modulo1-auth**.

## O que entra
- `src/lib/external/supabase.ts` — cliente público e admin com validação de ENV.
- `src/app/debug/page.tsx` — diagnóstico rápido (`/debug`).

## Como aplicar (PowerShell)
```powershell
# 1) Feche o dev server (Ctrl+C) e vá até o projeto
cd "C:\meus-projetos\publia-modulo1-auth"

# 2) Extraia por cima
Expand-Archive -LiteralPath "$HOME\Downloads\publia-auth-fix-pack-v2.zip" -DestinationPath . -Force

# 3) Reinstale dependências
npm install

# 4) Rode
npm run dev
```

## Ajustes nos imports
Nos seus actions, troque:
```ts
// de
import { supabaseAdmin, supabaseClient } from "@/lib/supabase";

// para
import { supabaseAdmin, supabaseClient } from "@/src/lib/external/supabase";
```

## Exemplo de uso no sign-up (Server Action)
```ts
"use server";
import { supabaseAdmin } from "@/src/lib/external/supabase";

export async function signUpAction(payload: {
  email: string; password: string;
  nome: string; cpf_cnpj: string; telefone: string; cidade_uf: string;
}) {
  const admin = supabaseAdmin();

  const created = await admin.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  const userId = created.data.user?.id;
  if (!userId) throw new Error("Falha ao obter user id");

  const { error } = await admin.from("profiles").insert({
    user_id: userId,
    nome: payload.nome,
    cpf_cnpj: payload.cpf_cnpj,
    email: payload.email,
    telefone: payload.telefone,
    cidade_uf: payload.cidade_uf,
  });

  if (error) throw error;
  return { ok: true };
}
```

## .env.local (exemplo)
```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_SUBDOMINIO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
SIGNUP_TOKEN=publia_nexus_2025_token_A1B2C3PATRIRACH8208
REDIRECT_BLOCKED_SIGNUP=https://nexuspublica.com.br/
```
Depois de subir o dev, abra `http://localhost:3000/debug`.
