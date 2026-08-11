$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.26 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "lib\klyx-economics.ts",
  "app\api\public\economics\route.ts",
  "app\founder\economics\page.tsx",
  "app\api\stripe\create-checkout-session\route.ts"
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$economics = Get-Content -LiteralPath "lib\klyx-economics.ts" -Raw
$checkout = Get-Content -LiteralPath "app\api\stripe\create-checkout-session\route.ts" -Raw
$page = Get-Content -LiteralPath "app\founder\economics\page.tsx" -Raw

if ($economics -notmatch 'KLYX_DEFAULT_COMMISSION_PERCENT = 15') {
  throw "Commission par defaut incorrecte."
}
Write-Host "[OK] Commission 15% centralisee" -ForegroundColor Green

if ($checkout -notmatch 'calculateKlyxEconomics') {
  throw "Checkout non relie au moteur economique."
}
Write-Host "[OK] Checkout relie au moteur economique" -ForegroundColor Green

if ($checkout -notmatch 'application_fee_amount') {
  throw "Stripe application fee absente."
}
Write-Host "[OK] Stripe Connect application fee conservee" -ForegroundColor Green

if ($checkout -notmatch 'transfer_data') {
  throw "Stripe destination transfer absent."
}
Write-Host "[OK] Transfert prestataire conserve" -ForegroundColor Green

if ($page -notmatch 'Combien gagne KLYX par mission') {
  throw "Calculateur founder absent."
}
Write-Host "[OK] Calculateur /founder/economics" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.26 BUILD VALIDE." -ForegroundColor Green
