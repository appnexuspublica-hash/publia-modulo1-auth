PUBLIA AUTH FIX PACK v3
=======================

O que vem no pacote
-------------------
1. src/lib/supabase.ts
   - Cria 2 clientes:
     a) supabaseBrowser (ANON) para client-side
     b) supabaseAdmin (SERVICE ROLE) para server actions
   - Garante que SERVICE ROLE só é usado em server (sem vazar ao browser).
   - Valida variáveis e lança erro claro se faltarem.

2. src/app/(auth)/criar-conta/formActions.ts
   - Fluxo robusto de criação de usuário + perfil:
     a) valida SIGNUP_TOKEN
     b) cria auth user (com GoTrueAdmin)
     c) insere na tabela profiles (user_id, cpf_cnpj, nome, email, telefone, cidade_uf)
   - Trata erros de rede e de Supabase com mensagens claras.

3. src/app/(debug)/debug-public/page.tsx
   - Página opcional de diagnóstico em: /debug-public
   - Mostra host do SUPABASE_URL, tamanho e prefixo da ANON KEY.
   - Remova após testar.

4. supabase/sql/001_profiles_schema_rls.sql
   - Cria a tabela profiles (se não existir) com RLS e políticas mínimas.
   - Campos: user_id (uuid PK, FK auth.users), cpf_cnpj, nome, email, telefone, cidade_uf, created_at, updated_at
   - Índices úteis e restrições básicas.

5. .env.local.example
   - Modelo de variáveis com placeholders.

6. scripts/test-env.ts
   - Script simples para imprimir se as chaves estão chegando no Node (server).

Como aplicar (PowerShell)
-------------------------
# 0) Pare o dev server se estiver rodando
taskkill /F /IM node.exe 2>$null

# 1) Vá até a pasta do seu projeto
cd C:\meus-projetos\publia-modulo1-auth

# 2) Faça backup das pastas que serão sobrescritas (opcional)
if (Test-Path .\src\lib\supabase.ts) { Copy-Item .\src\lib\supabase.ts .\src\lib\supabase.ts.bak -Force }

# 3) Extraia o zip na raiz do projeto (substituir arquivos)
Expand-Archive -Path .\publia-auth-fix-pack-v3.zip -DestinationPath . -Force

# 4) Crie e preencha .env.local a partir do exemplo
Copy-Item .env.local.example .env.local -Force
# Edite .env.local com seus valores reais (URL/KEY/TOKEN)

# 5) Rode o SQL no Supabase (apenas 1x)
#    Copie o conteúdo de .\supabase\sql\001_profiles_schema_rls.sql e execute no SQL Editor do seu projeto no Supabase.

# 6) Teste as variáveis
npx tsx scripts/test-env.ts

# 7) Suba o dev server
npm run dev

# 8) Acesse as rotas para teste
#    - http://localhost:3000/debug-public  (remover depois)
#    - http://localhost:3000/criar-conta?tk=SEU_TOKEN (use o mesmo do .env.local)

Notas importantes
-----------------
- Adicione "type": "module" ao seu package.json para remover o warning do Next (opcional):
  {
    "type": "module",
    ...
  }

- Se aparecer ENOTFOUND no host do Supabase, geralmente é URL inválida no .env.local ou variável não carregou no server.
  Use o /debug-public e o scripts/test-env.ts para validar.

- Este pacote não altera sua UI, apenas a integração com o Supabase e o fluxo das server actions.
