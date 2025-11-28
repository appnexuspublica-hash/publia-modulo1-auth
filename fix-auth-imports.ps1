param(
  [Parameter(Mandatory=$true)][string]$ProjectPath,
  [string]$BrandHint # opcional: caminho relativo a partir da raiz (ex.: 'src\app\components\brand.tsx' ou 'src\components\brand.tsx')
)

Write-Host "== Fix Auth Imports (relative paths) ==" -ForegroundColor Cyan
if (-not (Test-Path $ProjectPath)) { Write-Error "Caminho inválido: $ProjectPath"; exit 1 }
Set-Location $ProjectPath

function Find-BrandFile {
  param([string]$Hint)
  if ($Hint) {
    $p = Join-Path (Get-Location) $Hint
    if (Test-Path $p) { return (Resolve-Path $p).Path }
  }
  $files = Get-ChildItem -Path "src" -Recurse -File -Include brand.tsx,brand.ts,brand.jsx,brand.js -ErrorAction SilentlyContinue
  if ($files.Count -gt 0) {
    # prioriza dentro de src\app\components
    $pref = $files | Where-Object { $_.FullName -match "\\src\\app\\components\\brand\." } | Select-Object -First 1
    if ($pref) { return $pref.FullName }
    return $files[0].FullName
  }
  return $null
}

$brand = Find-BrandFile -Hint $BrandHint
if (-not $brand) {
  Write-Error "Não encontrei brand.(ts|tsx|js|jsx) dentro de 'src'. Informe -BrandHint se o arquivo estiver fora do padrão."
  exit 1
}

# Alvos
$pages = @(
  "src\app\(auth)\criar-conta\page.tsx",
  "src\app\(auth)\login\page.tsx",
  "src\app\(auth)\recuperar-senha\page.tsx"
)

# Função para obter path relativo com .NET
Add-Type -AssemblyName System.Runtime.Extensions
$root = (Resolve-Path ".").Path

foreach ($p in $pages) {
  if (-not (Test-Path $p)) { Write-Warning "Arquivo não encontrado: $p"; continue }

  $fromDir = Split-Path (Resolve-Path $p).Path
  $rel = [System.IO.Path]::GetRelativePath($fromDir, $brand).Replace("\","/")

  # Normaliza para import sem extensão
  if ($rel -match "\.tsx$" -or $rel -match "\.ts$" -or $rel -match "\.jsx$" -or $rel -match "\.js$") {
    $rel = $rel -replace "\.tsx$","" -replace "\.ts$","" -replace "\.jsx$","" -replace "\.js$",""
  }
  if (-not $rel.StartsWith(".")) { $rel = "./" + $rel }

  $content = Get-Content -Raw -Path $p

  # Reescreve imports dos componentes compartilhados para relativos fixos (se ainda houver alias)
  $content = $content `
    -replace 'from "@/components/auth/AuthCard"',       'from "../../../components/auth/AuthCard"' `
    -replace 'from "@/components/auth/AuthTitle"',      'from "../../../components/auth/AuthTitle"' `
    -replace 'from "@/components/auth/AuthInput"',      'from "../../../components/auth/AuthInput"' `
    -replace 'from "@/components/auth/SubmitButton"',   'from "../../../components/auth/SubmitButton"' `
    -replace 'from "@/components/auth/Alert"',          'from "../../../components/auth/Alert"'

  # Reescreve import do Brand para o caminho relativo real
  # Substitui qualquer uma das variantes anteriores
  $content = $content `
    -replace 'from "../../components/brand"',           "from '$rel'" `
    -replace 'from "../components/brand"',              "from '$rel'" `
    -replace 'from "../../../components/brand"',        "from '$rel'" `
    -replace 'from "@/app/components/brand"',           "from '$rel'" `
    -replace 'from "@/components/brand"',               "from '$rel'"

  Set-Content -Path $p -Value $content -Encoding utf8
  Write-Host ("Atualizado: {0}  -> import Brand from '{1}'" -f $p, $rel) -ForegroundColor Green
}

Write-Host "`nLimpe o cache e rode novamente:" -ForegroundColor Cyan
Write-Host '  if (Test-Path ".next") { rmdir .next -Recurse -Force }'
Write-Host '  npm run dev'
