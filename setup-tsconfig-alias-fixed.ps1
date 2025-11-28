param(
  [Parameter(Mandatory=$true)][string]$ProjectPath
)

Write-Host "== Setup tsconfig alias '@' -> 'src' (fix) ==" -ForegroundColor Cyan
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

# Load JSON
$raw = Get-Content -Raw -Path $tsPath -Encoding UTF8
$config = $raw | ConvertFrom-Json

# Ensure compilerOptions object
if (-not $config.compilerOptions) { $config | Add-Member -MemberType NoteProperty -Name compilerOptions -Value ([pscustomobject]@{}) }

# Set baseUrl
$config.compilerOptions.baseUrl = "src"

# Ensure paths object
if (-not $config.compilerOptions.paths) { $config.compilerOptions | Add-Member -MemberType NoteProperty -Name paths -Value ([pscustomobject]@{}) }

# Add or update "@/*" using Add-Member to support special chars
$pathsProps = $config.compilerOptions.paths.PSObject.Properties
$hasAt = $false
foreach ($p in $pathsProps) {
  if ($p.Name -eq "@/*") { $hasAt = $true; break }
}
if (-not $hasAt) {
  Add-Member -InputObject $config.compilerOptions.paths -MemberType NoteProperty -Name "@/*" -Value @("*")
} else {
  # update existing
  $config.compilerOptions.paths.PSObject.Properties.Item("@/*").Value = @("*")
}

# Save JSON (UTF-8 sem BOM se possível)
$json = $config | ConvertTo-Json -Depth 100
try {
  if ($PSVersionTable.PSVersion.Major -ge 7) {
    Set-Content -Path $tsPath -Value $json -Encoding utf8NoBOM
  } else {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tsPath, $json, $utf8)
  }
} catch {
  Set-Content -Path $tsPath -Value $json -Encoding utf8
}

Write-Host "Alias configurado: '@/*' -> 'src/*' e baseUrl = 'src'." -ForegroundColor Green
Write-Host "Reinicie o dev server para aplicar:"
Write-Host '  if (Test-Path ".next") { rmdir .next -Recurse -Force }'
Write-Host '  npm run dev'
