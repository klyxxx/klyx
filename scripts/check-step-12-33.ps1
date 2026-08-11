$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.33 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "app\api\brain\market-status\[id]\route.ts",
  "app\assistant\market\[id]\MarketStatusTracker.tsx",
  "app\assistant\market\[id]\page.tsx"
)

foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$route = Get-Content -LiteralPath "app\api\brain\market-status\[id]\route.ts" -Raw
$tracker = Get-Content -LiteralPath "app\assistant\market\[id]\MarketStatusTracker.tsx" -Raw
$page = Get-Content -LiteralPath "app\assistant\market\[id]\page.tsx" -Raw

foreach ($stage in @(
  "waiting_offers",
  "compare_offers",
  "finalize_booking",
  "payment_pending",
  "paid",
  "completed"
)) {
  if ($route -notmatch [regex]::Escape($stage)) {
    throw "Etape copilote absente : $stage"
  }
}

Write-Host "[OK] Cycle demande -> offres -> booking -> paiement" -ForegroundColor Green

if ($route -notmatch 'market_request_id' -or
    $route -notmatch 'quote_id') {
  throw "Liens transactionnels incomplets."
}
Write-Host "[OK] Devis + reservation relies" -ForegroundColor Green

if ($tracker -notmatch '30000') {
  throw "Actualisation automatique absente."
}
Write-Host "[OK] Suivi automatique 30s" -ForegroundColor Green

if ($tracker -notmatch 'nextHref' -or
    $tracker -notmatch 'nextLabel') {
  throw "Prochaine action absente."
}
Write-Host "[OK] Prochaine action dynamique" -ForegroundColor Green

if ($page -notmatch 'MarketStatusTracker') {
  throw "Copilote absent de la page conseiller."
}
Write-Host "[OK] Copilote visible dans /assistant/market/[id]" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.33 BUILD VALIDE." -ForegroundColor Green
