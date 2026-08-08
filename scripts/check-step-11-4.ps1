$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX ETAPE 11.4 - SUPPRESSION SECURISEE" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "app\api\founder\accounts-cleanup\route.ts",
  "app\founder\cleanup\page.tsx"
)

$failed = $false

foreach ($file in $files) {
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
  Write-Host "PRECHECK 11.4 NON VALIDE." -ForegroundColor Red
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
Write-Host "KLYX 11.4 BUILD VALIDE." -ForegroundColor Green
Write-Host "Teste ensuite : /founder/cleanup" -ForegroundColor Cyan
