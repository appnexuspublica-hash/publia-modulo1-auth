# Setup alias '@' -> 'src' para Next/TypeScript

Este script ajusta seu `tsconfig.json` (ou `jsconfig.json`) para que o alias `@` aponte para `src`, permitindo imports como:
```ts
import Brand from "@/app/components/brand";
```

## Uso
1. Coloque `setup-tsconfig-alias.ps1` na **raiz do projeto**.
2. Rode no PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File .\setup-tsconfig-alias.ps1 -ProjectPath .
```
3. Reinicie o dev:
```powershell
if (Test-Path ".next") { rmdir .next -Recurse -Force }
npm run dev
```
