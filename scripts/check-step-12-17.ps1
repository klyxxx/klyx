$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.17 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$checkout = Get-Content -LiteralPath "app\api\stripe\create-checkout-session\route.ts" -Raw
$booking = Get-Content -LiteralPath "app\api\bookings\create\route.ts" -Raw
$audit = Get-Content -LiteralPath "app\api\founder\transaction-readiness\route.ts" -Raw
$page = Get-Content -LiteralPath "app\founder\transaction-test\page.tsx" -Raw

if ($checkout -notmatch 'ancienne réservation ne contient pas de métier complet') {
  throw "Protection ancien booking sans service absente."
}
Write-Host "[OK] Aucun paiement d ancienne reservation sans service" -ForegroundColor Green

if ($checkout -match 'const labels: Record<string, string>') {
  throw "Labels fixes encore presents dans Stripe checkout."
}
Write-Host "[OK] Checkout Stripe service dynamique" -ForegroundColor Green

if ($booking -match 'const labels: Record<string, string>') {
  throw "Labels fixes encore presents dans booking create."
}
Write-Host "[OK] Booking service dynamique" -ForegroundColor Green

if ($audit -notmatch 'payment_duplicates') {
  throw "Audit anti-double paiement absent."
}
Write-Host "[OK] Audit anti-double paiement" -ForegroundColor Green

if ($audit -notmatch 'completed_paid') {
  throw "Audit completed/paid absent."
}
Write-Host "[OK] Audit mission/paiement" -ForegroundColor Green

if ($page -notmatch '/api/founder/transaction-readiness') {
  throw "Page Founder transaction test invalide."
}
Write-Host "[OK] /founder/transaction-test" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.17 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
