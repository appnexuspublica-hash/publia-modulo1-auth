param(
  [Parameter(Mandatory=$true)][string]$ProjectPath
)

Write-Host "== Publ.IA Auth Fix Installer ==" -ForegroundColor Cyan
if (-not (Test-Path $ProjectPath)) { Write-Error "Caminho inválido: $ProjectPath"; exit 1 }
Set-Location $ProjectPath

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $ProjectPath ".backup-auth-fix-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

function Backup-IfExists([string]$p) {
  if (Test-Path $p) {
    $dest = Join-Path $backup $p
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    Copy-Item $p $dest -Force -Recurse
  }
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$zipPath = Join-Path $here "publia-auth-fix-brand-and-action.zip"
if (-not (Test-Path $zipPath)) { Write-Error "ZIP não encontrado ao lado do script."; exit 1 }

$temp = Join-Path $env:TEMP ("publia-auth-fix-" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $temp | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $temp)

$targets = @(
  "src\components\auth\AuthTitle.tsx",
  "src\app\(auth)\criar-conta\page.tsx",
  "src\app\(auth)\criar-conta\formActions.ts",
  "src\app\(auth)\login\page.tsx",
  "src\app\(auth)\recuperar-senha\page.tsx"
)

foreach ($rel in $targets) {
  $src = Join-Path $temp $rel
  $dst = $rel
  Backup-IfExists $dst
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  Copy-Item $src $dst -Force
  Write-Host ("Atualizado: {0}" -f $dst) -ForegroundColor Green
}

Write-Host "`nConcluído! Backup em: $backup" -ForegroundColor Cyan
Write-Host "Depois execute:"
Write-Host '  if (Test-Path ".next") { rmdir .next -Recurse -Force }'
Write-Host '  npm run dev'
