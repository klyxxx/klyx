$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX ETAPE 11.7 - FOUNDER COMPACT" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "app\components\FounderAccessBar.tsx",
  "app\components\FounderCompactMenu.tsx",
  "app\layout.tsx"
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
  Write-Host "PRECHECK 11.7 NON VALIDE." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "11.5 visuellement annule :" -ForegroundColor Yellow
Write-Host "- plus de barre Founder permanente"
Write-Host "- plus de hauteur prise en haut de chaque page"
Write-Host "- fonctions Founder conservees dans un bouton compact"
Write-Host ""

Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

& npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 11.7 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
