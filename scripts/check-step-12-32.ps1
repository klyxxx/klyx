$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.32 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$path = "app\assistant\market\[id]\page.tsx"

if (-not (Test-Path -LiteralPath $path)) {
  throw "Fichier manquant : $path"
}

$content = Get-Content -LiteralPath $path -Raw

if ($content -notmatch "Choisir avec KLYX") {
  throw "CTA assistant absent."
}
Write-Host "[OK] CTA Choisir avec KLYX" -ForegroundColor Green

if ($content -notmatch "Confirmer mon choix") {
  throw "Confirmation explicite absente."
}
Write-Host "[OK] Confirmation explicite" -ForegroundColor Green

if ($content -notmatch '/api/market/requests/\$\{params\.id\}/offers') {
  throw "API offres existante non reutilisee."
}
Write-Host "[OK] API offres transactionnelle reutilisee" -ForegroundColor Green

if ($content -notmatch 'action: "accept"') {
  throw "Action accept absente."
}
Write-Host "[OK] Acceptation uniquement apres confirmation" -ForegroundColor Green

if ($content -notmatch "body\.bookingHref" -or
    $content -notmatch "/quotes/\$\{body\.quoteId\}/book") {
  throw "Handoff booking incomplet."
}
Write-Host "[OK] Handoff vers reservation" -ForegroundColor Green

if ($content -match "application_fee_amount" -or
    $content -match "create-checkout-session") {
  throw "Le conseiller ne doit pas declencher le paiement."
}
Write-Host "[OK] Aucun paiement automatique" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.32 BUILD VALIDE." -ForegroundColor Green
