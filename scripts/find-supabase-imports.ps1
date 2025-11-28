\
  # scripts/find-supabase-imports.ps1
  Write-Host "Procurando imports '@/lib/supabase' e 'createClient'..." -ForegroundColor Cyan
  Get-ChildItem -Recurse -Include *.ts,*.tsx -ErrorAction SilentlyContinue | `
    Select-String -Pattern "@/lib/supabase" -List | ForEach-Object {
      "{0}:{1}  {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim()
    }
  Write-Host "`nLocais com createClient (para auditoria manual):" -ForegroundColor Cyan
  Get-ChildItem -Recurse -Include *.ts,*.tsx -ErrorAction SilentlyContinue | `
    Select-String -Pattern "createClient\s*\(" -List | ForEach-Object {
      "{0}:{1}  {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim()
    }
