$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX ETAPE 12.5 - VERIFICATION SECURITE" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "app\api\founder\test-center\route.ts",
  "supabase\migrations\20260809_step_12_5_security_gate.sql"
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $file))) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$content = Get-Content -LiteralPath (Join-Path $root "app\api\founder\test-center\route.ts") -Raw

if ($content -notmatch 'security-rls') {
  throw "Security Gate absent du Test Center."
}

if ($content -notmatch 'klyx_security_audit') {
  throw "RPC klyx_security_audit absente du Test Center."
}

Write-Host "[OK] Test Center controle RLS" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.5 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Puis ouvre /founder/test apres deploiement." -ForegroundColor Cyan
