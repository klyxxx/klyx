$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.12 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "lib\provider-score.ts",
  "app\api\scores\recalculate\route.ts",
  "app\scores\page.tsx",
  "app\api\reviews\route.ts"
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$score = Get-Content -LiteralPath "lib\provider-score.ts" -Raw
$route = Get-Content -LiteralPath "app\api\scores\recalculate\route.ts" -Raw
$reviews = Get-Content -LiteralPath "app\api\reviews\route.ts" -Raw

if ($score -match 'eq\("slug", "babysitting"\)') {
  throw "Le score est encore limite au baby-sitting."
}
Write-Host "[OK] Tous les metiers" -ForegroundColor Green

if ($score -notmatch 'provider_id') {
  throw "provider_id absent."
}
if ($score -notmatch 'babysitter_id') {
  throw "Compatibilite legacy babysitter_id absente."
}
Write-Host "[OK] provider_id + compatibilite legacy" -ForegroundColor Green

if ($score -notmatch 'reviews') {
  throw "Avis verifies absents du calcul."
}
Write-Host "[OK] Avis integres au KLYX Score" -ForegroundColor Green

if ($route -notmatch 'profile\.id') {
  throw "Le recalcul n'est pas limite au prestataire authentifie."
}
Write-Host "[OK] Prestataire authentifie uniquement" -ForegroundColor Green

if ($reviews -notmatch 'recalculateProviderScores\(providerId\)') {
  throw "Recalcul automatique apres avis absent."
}
Write-Host "[OK] Recalcul automatique apres avis" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.12 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
