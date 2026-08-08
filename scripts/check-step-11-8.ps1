$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX ETAPE 11.8 - VALIDATION FINALE" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "app\founder\final-check\page.tsx",
  "app\components\FounderCompactMenu.tsx",
  "app\api\founder\status\route.ts",
  "app\api\founder\accounts-audit\route.ts",
  "app\api\admin\access\route.ts"
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
  Write-Host "PRECHECK 11.8 NON VALIDE." -ForegroundColor Red
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
Write-Host "KLYX 11.8 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Teste ensuite : /founder/final-check" -ForegroundColor Cyan
