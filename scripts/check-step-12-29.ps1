$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.29 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "lib\client-offer-ranking.ts",
  "app\api\market\requests\route.ts",
  "app\requests\page.tsx"
)

foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$engine = Get-Content -LiteralPath "lib\client-offer-ranking.ts" -Raw
$api = Get-Content -LiteralPath "app\api\market\requests\route.ts" -Raw
$page = Get-Content -LiteralPath "app\requests\page.tsx" -Raw

if ($engine -notmatch "calculateClientOfferRanking") {
  throw "Moteur de classement client absent."
}
Write-Host "[OK] Moteur classement client" -ForegroundColor Green

if ($api -notmatch "isRecommended" -or
    $api -notmatch "isCheapest") {
  throw "Tags recommandation/prix absents."
}
Write-Host "[OK] Recommande + moins cher" -ForegroundColor Green

if ($api -notmatch "providerStats" -or
    $api -notmatch "yearsExperience" -or
    $api -notmatch "isVerified") {
  throw "Stats prestataire incompletes."
}
Write-Host "[OK] Reputation + experience + verification" -ForegroundColor Green

if ($page -notmatch "Recommandé par KLYX" -or
    $page -notmatch "Recommandation") {
  throw "Explication client absente."
}
Write-Host "[OK] Explication visible cote client" -ForegroundColor Green

if ($page -notmatch "Choisir ce prestataire") {
  throw "CTA choix client absent."
}
Write-Host "[OK] Client garde la decision finale" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.29 BUILD VALIDE." -ForegroundColor Green
