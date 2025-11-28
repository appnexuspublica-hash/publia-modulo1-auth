param(
  [Parameter(Mandatory=$true)][string]$ProjectPath
)

Write-Host "== Publ.IA Auth UI Pack Installer ==" -ForegroundColor Cyan
if (-not (Test-Path $ProjectPath)) { Write-Error "Caminho inválido: $ProjectPath"; exit 1 }
Set-Location $ProjectPath

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $ProjectPath ".backup-auth-ui-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

function Backup-IfExists {
  param([string]$p)
  if (Test-Path $p) {
    $dest = Join-Path $backup $p
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    Copy-Item $p $dest -Force -Recurse
  }
}

$dirs = @(
  "src\components\auth",
  "src\app\(auth)\login",
  "src\app\(auth)\criar-conta",
  "src\app\(auth)\recuperar-senha"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$zipPath = Join-Path $here "publia-auth-ui-pack.zip"
if (-not (Test-Path $zipPath)) { Write-Error "publia-auth-ui-pack.zip não encontrado ao lado do script."; exit 1 }

$temp = Join-Path $env:TEMP ("publia-auth-ui-" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $temp | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $temp)

$mapping = @{
  "src\components\auth\AuthCard.tsx" = "src\components\auth\AuthCard.tsx";
  "src\components\auth\AuthTitle.tsx" = "src\components\auth\AuthTitle.tsx";
  "src\components\auth\AuthInput.tsx" = "src\components\auth\AuthInput.tsx";
  "src\components\auth\SubmitButton.tsx" = "src\components\auth\SubmitButton.tsx";
  "src\components\auth\Alert.tsx" = "src\components\auth\Alert.tsx";
  "src\app\(auth)\login\page.tsx" = "src\app\(auth)\login\page.tsx";
  "src\app\(auth)\criar-conta\page.tsx" = "src\app\(auth)\criar-conta\page.tsx";
  "src\app\(auth)\recuperar-senha\page.tsx" = "src\app\(auth)\recuperar-senha\page.tsx";
}

foreach ($k in $mapping.Keys) {
  $src = Join-Path $temp $k
  $dst = $mapping[$k]
  Backup-IfExists -p $dst
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  Copy-Item $src $dst -Force
  Write-Host ("Atualizado: {0}" -f $dst) -ForegroundColor Green
}

Write-Host "`nConcluído! Arquivos antigos em: $backup" -ForegroundColor Cyan
Write-Host "Depois rode:"
Write-Host '  if (Test-Path ".next") { rmdir .next -Recurse -Force }'
Write-Host '  npm run dev'
