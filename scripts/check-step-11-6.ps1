$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX ETAPE 11.6 - SWITCH FOUNDER" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "app\components\FounderAccessBar.tsx",
  "app\components\FounderModeSwitcher.tsx",
  "app\api\profiles\active\route.ts",
  "lib\active-profile.ts"
)

$failed = $false

foreach ($file in $required) {
  if (Test-Path -LiteralPath (Join-Path $root $file)) {
    Write-Host "[OK] $file" -ForegroundColor Green
  }
  else {
    Write-Host "[ECHEC] $file" -ForegroundColor Red
    $failed = $true
  }
}

if ($failed) {
  Write-Host ""
  Write-Host "PRECHECK 11.6 NON VALIDE." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

& npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 11.6 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Teste Client -> Prestataire -> Client sans reconnexion." -ForegroundColor Cyan
