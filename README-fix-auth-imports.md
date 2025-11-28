# Fix Auth Imports

Este script procura o arquivo `brand.*` em `src/**` e corrige os imports nas páginas de autenticação para **caminhos relativos corretos**.

## Uso
```powershell
# Na raiz do projeto
powershell -ExecutionPolicy Bypass -File .\fix-auth-imports.ps1 -ProjectPath .
```
Se o arquivo de brand estiver em um caminho incomum, passe o hint:
```powershell
powershell -ExecutionPolicy Bypass -File .\fix-auth-imports.ps1 -ProjectPath . -BrandHint 'src\components\branding\brand.tsx'
```

Após rodar:
```powershell
if (Test-Path ".next") { rmdir .next -Recurse -Force }
npm run dev
```
