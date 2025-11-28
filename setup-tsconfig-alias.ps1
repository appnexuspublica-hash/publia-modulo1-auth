param(
  [Parameter(Mandatory=$true)][string]$ProjectPath
)

Write-Host "== Setup tsconfig alias '@' -> 'src' ==" -ForegroundColor Cyan
if (-not (Test-Path $ProjectPath)) { Write-Error "Caminho inválido: $ProjectPath"; exit 1 }
Set-Location $ProjectPath

# Detect tsconfig file (tsconfig.json or jsconfig.json)
$tsPath = Join-Path $ProjectPath "tsconfig.json"
if (-not (Test-Path $tsPath)) {
  $tsPath = Join-Path $ProjectPath "jsconfig.json"
  if (-not (Test-Path $tsPath)) {
    Write-Error "Não encontrei tsconfig.json nem jsconfig.json na raiz do projeto."
    exit 1
  }
}

# Backup
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$tsPath.bak.$stamp"
Copy-Item $tsPath $backup -Force
Write-Host "Backup criado em: $backup" -ForegroundColor Yellow

# Load JSON preserving formatting minimally
function Get-Json {
  param([string]$Path)
  $raw = Get-Content -Raw -Path $Path -Encoding UTF8
  return $raw | ConvertFrom-Json
}

function Save-Json {
  param([object]$Obj, [string]$Path)
  $json = $Obj | ConvertTo-Json -Depth 100
  # Write UTF-8 without BOM if possible
  try {
    $psv = $PSVersionTable.PSVersion.Major
    if ($psv -ge 7) { Set-Content -Path $Path -Value $json -Encoding utf8NoBOM }
    else {
      $utf8 = New-Object System.Text.UTF8Encoding($false)
      [System.IO.File]::WriteAllText($Path, $json, $utf8)
    }
  } catch {
    Set-Content -Path $Path -Value $json -Encoding utf8
  }
}

$config = Get-Json -Path $tsPath

if (-not $config.compilerOptions) { $config | Add-Member -MemberType NoteProperty -Name compilerOptions -Value (@{}) }
if (-not $config.compilerOptions.baseUrl) { $config.compilerOptions.baseUrl = "src" } else { $config.compilerOptions.baseUrl = "src" }
if (-not $config.compilerOptions.paths) { $config.compilerOptions | Add-Member -MemberType NoteProperty -Name paths -Value (@{}) }

# Ensure "@/*": ["*"]
$config.compilerOptions.paths."@/*" = @("*")

Save-Json -Obj $config -Path $tsPath

Write-Host "Alias configurado: '@/*' -> 'src/*' e baseUrl = 'src'." -ForegroundColor Green
Write-Host "Reinicie o dev server para aplicar:"
Write-Host '  if (Test-Path ".next") { rmdir .next -Recurse -Force }'
Write-Host '  npm run dev'
