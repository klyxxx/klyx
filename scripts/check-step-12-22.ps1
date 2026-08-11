$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.22 - VERIFICATION" -ForegroundColor Cyan

$quotePath = "app\providers\[id]\quote\page.tsx"
$providerPath = "app\providers\[id]\page.tsx"

if (-not (Test-Path -LiteralPath $quotePath)) { throw "Page devis absente." }
Write-Host "[OK] /providers/[id]/quote" -ForegroundColor Green

$quote = Get-Content -LiteralPath $quotePath -Raw
$provider = Get-Content -LiteralPath $providerPath -Raw

if ($quote -notmatch 'fetch\("/api/quotes"') { throw "API quotes non reliee." }
Write-Host "[OK] Relie a /api/quotes" -ForegroundColor Green

if ($quote -notmatch 'providerProfileId' -or $quote -notmatch 'userServiceId') {
  throw "Ciblage devis incomplet."
}
Write-Host "[OK] Prestataire + metier cibles" -ForegroundColor Green

if ($provider -notmatch 'Demander un devis') { throw "CTA devis absent." }
if ($provider -notmatch 'Réserver directement') { throw "CTA reservation directe absent." }
Write-Host "[OK] Deux parcours visibles" -ForegroundColor Green

if ($quote -notmatch 'ne réserve rien' -or $quote -notmatch 'aucun paiement') {
  throw "Separation devis/reservation non expliquee."
}
Write-Host "[OK] Devis sans reservation/paiement automatique" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.22 BUILD VALIDE." -ForegroundColor Green
