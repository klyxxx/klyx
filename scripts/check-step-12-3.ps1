$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX ETAPE 12.3 - TEST CENTER" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "app\api\founder\test-center\route.ts",
  "app\founder\test\page.tsx",
  "lib\founder-auth.ts",
  "lib\admin-auth.ts",
  "lib\stripe-runtime.ts"
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $file))) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.3 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ouvre ensuite /founder/test" -ForegroundColor Cyan
