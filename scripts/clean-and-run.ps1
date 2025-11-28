\
  # scripts/clean-and-run.ps1
  Write-Host "Limpando cache do Next (.next)..." -ForegroundColor Yellow
  if (Test-Path .next) { Remove-Item .next -Recurse -Force }
  Write-Host "Iniciando dev server..." -ForegroundColor Green
  npm run dev
