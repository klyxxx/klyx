$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.10 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "app\globals.css",
  "app\favicon.ico",
  "public\icon.svg",
  "public\icons\icon-192.png",
  "public\icons\icon-512.png",
  "public\icons\apple-touch-icon.png"
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$globals = Get-Content -LiteralPath "app\globals.css" -Raw

if ($globals -notmatch "KLYX 12\.10 - THEME FINAL \+ MOBILE SAFARI") {
  throw "Couche CSS 12.10 absente."
}

if ($globals -notmatch 'button\[aria-label="Ouvrir le menu"\]') {
  throw "Correction hamburger absente."
}

if ($globals -notmatch 'input\[type="date"\]') {
  throw "Correction date mobile absente."
}

if ($globals -notmatch 'input\[type="time"\]') {
  throw "Correction heure mobile absente."
}

Write-Host "[OK] Mode clair legacy neutralise" -ForegroundColor Green
Write-Host "[OK] Hamburger clair/sombre" -ForegroundColor Green
Write-Host "[OK] Date/heure mobile Safari" -ForegroundColor Green
Write-Host "[OK] Favicon + PWA icons" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.10 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
