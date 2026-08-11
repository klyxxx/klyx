$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.25 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "supabase\migrations\20260811_step_12_25_market_to_booking.sql",
  "app\api\market\requests\route.ts",
  "app\api\market\requests\[id]\offers\route.ts",
  "app\requests\page.tsx"
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$sql = Get-Content -LiteralPath "supabase\migrations\20260811_step_12_25_market_to_booking.sql" -Raw
$offers = Get-Content -LiteralPath "app\api\market\requests\[id]\offers\route.ts" -Raw
$requests = Get-Content -LiteralPath "app\api\market\requests\route.ts" -Raw
$page = Get-Content -LiteralPath "app\requests\page.tsx" -Raw

if ($sql -notmatch 'market_request_id') {
  throw "Lien market_request_id absent."
}
Write-Host "[OK] Demande ouverte liee a service_quotes" -ForegroundColor Green

if ($offers -notmatch 'pricing_type: "fixed"' -or $offers -notmatch 'provider_price: Number\(offer.amount\)') {
  throw "Prix accepte non verrouille dans service_quotes."
}
Write-Host "[OK] Prix de l'offre verrouille" -ForegroundColor Green

if ($offers -notmatch 'status: "accepted"' -or $offers -notmatch 'accepted_at: now') {
  throw "Devis automatique non accepte."
}
Write-Host "[OK] Devis KLYX accepte automatiquement" -ForegroundColor Green

if ($requests -notmatch 'bookingQuote') {
  throw "Hydratation bookingQuote absente."
}
Write-Host "[OK] Client recupere le devis de reservation" -ForegroundColor Green

if ($page -notmatch 'Finaliser la réservation' -or $page -notmatch '/quotes/\$\{item.bookingQuote.id\}/book') {
  throw "CTA finalisation reservation absent."
}
Write-Host "[OK] CTA vers le moteur de reservation existant" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.25 BUILD VALIDE." -ForegroundColor Green
