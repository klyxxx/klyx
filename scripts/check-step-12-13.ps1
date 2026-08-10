$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.13 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "app\api\providers\[id]\reviews\route.ts",
  "app\providers\[id]\PublicReviews.tsx",
  "app\providers\[id]\page.tsx"
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$api = Get-Content -LiteralPath "app\api\providers\[id]\reviews\route.ts" -Raw
$page = Get-Content -LiteralPath "app\providers\[id]\page.tsx" -Raw
$component = Get-Content -LiteralPath "app\providers\[id]\PublicReviews.tsx" -Raw

if ($api -notmatch 'status === "completed"') {
  throw "Verification reservation completed absente."
}
Write-Host "[OK] Avis issus de missions terminees" -ForegroundColor Green

if ($api -notmatch 'provider_id.*babysitter_id') {
  throw "Compatibilite provider_id/babysitter_id absente."
}
Write-Host "[OK] Tous les metiers + compatibilite legacy" -ForegroundColor Green

if ($page -notmatch 'PublicReviews') {
  throw "Bloc avis absent du profil prestataire."
}
Write-Host "[OK] Avis visibles sur /providers/[id]" -ForegroundColor Green

if ($component -notmatch 'Avis vérifiés') {
  throw "Titre avis verifies absent."
}
Write-Host "[OK] UI avis verifies" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.13 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
