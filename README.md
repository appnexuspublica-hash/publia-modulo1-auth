
# Publ.IA — Módulo 1 (Auth)

## Como extrair direto da pasta Downloads (PowerShell)
```powershell
# 1) Criar pasta destino
New-Item -ItemType Directory -Force -Path "C:\meus-projetos\publia-modulo1-auth" | Out-Null

# 2) Extrair ZIP
Expand-Archive -LiteralPath "C:\Users\Valter Patriarca\Downloads\publia-modulo1-auth-full.zip" -DestinationPath "C:\meus-projetos\publia-modulo1-auth" -Force

# 3) Entrar no projeto e abrir
cd "C:\meus-projetos\publia-modulo1-auth"
copy .env.example .env
# Edite .env e preencha as chaves do Supabase. Salve o arquivo.
npm install
npm run dev
```

## URLs
- Criar conta (com token): `http://localhost:3000/criar-conta?tk=SEU_TOKEN_EXATO`
- Login: `http://localhost:3000/login`
- Recuperar senha: `http://localhost:3000/recuperar-senha`

> **Importante:** Sempre **reinicie** `npm run dev` quando mudar o `.env` para que o `SIGNUP_TOKEN` seja recarregado.
