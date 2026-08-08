$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX ETAPE 12.0 - BETA PUBLIQUE" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "app\beta\page.tsx",
  "app\signup\page.tsx",
  "app\onboarding\page.tsx",
  "app\onboarding\FirstProfileSetup.tsx",
  "app\login\page.tsx",
  "app\install\page.tsx"
)

$failed = $false

foreach ($file in $required) {
  if (
    Test-Path -LiteralPath (
      Join-Path $root $file
    )
  ) {
    Write-Host "[OK] $file" -ForegroundColor Green
  }
  else {
    Write-Host "[ECHEC] $file" -ForegroundColor Red
    $failed = $true
  }
}

if ($failed) {
  Write-Host ""
  Write-Host "PRECHECK 12.0 NON VALIDE." -ForegroundColor Red
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
Write-Host "KLYX 12.0 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Nouvelle porte d'entree Beta : /beta" -ForegroundColor Cyan
