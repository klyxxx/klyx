$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.23 - VERIFICATION" -ForegroundColor Cyan

$path = "app\onboarding\ProviderOnboardingProgress.tsx"
$content = Get-Content -LiteralPath $path -Raw

if ($content -notmatch 'fetch\("/api/provider/studio"') { throw "Studio absent." }
Write-Host "[OK] Studio prestataire reel" -ForegroundColor Green

foreach ($label in @(
  "Profil professionnel",
  "Métier proposé",
  "Tarif",
  "Zone d’intervention",
  "Disponibilités",
  "Vérification et confiance",
  "Paiements",
  "Publication"
)) {
  if ($content -notmatch [regex]::Escape($label)) { throw "Etape absente : $label" }
}
Write-Host "[OK] 8 etapes presentes" -ForegroundColor Green

if ($content -notmatch 'yearsExperience') { throw "Experience absente." }
Write-Host "[OK] Experience prise en compte" -ForegroundColor Green

if ($content -notmatch 'hourlyPrice' -or $content -notmatch 'fixedPrice') {
  throw "Tarification incomplete."
}
Write-Host "[OK] Prix horaire/forfaitaire pris en compte" -ForegroundColor Green

if ($content -notmatch 'availability') { throw "Disponibilites absentes." }
Write-Host "[OK] Disponibilites prises en compte" -ForegroundColor Green

if ($content -notmatch 'payoutsEnabled') { throw "Stripe payouts absent." }
Write-Host "[OK] Paiements prestataire pris en compte" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.23 BUILD VALIDE." -ForegroundColor Green
