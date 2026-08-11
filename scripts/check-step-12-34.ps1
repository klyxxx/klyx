$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.34 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "app\api\brain\actions\route.ts",
  "app\assistant\actions\page.tsx",
  "app\assistant\market\[id]\MarketStatusTracker.tsx"
)

foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$route = Get-Content -LiteralPath "app\api\brain\actions\route.ts" -Raw
$page = Get-Content -LiteralPath "app\assistant\actions\page.tsx" -Raw
$tracker = Get-Content -LiteralPath "app\assistant\market\[id]\MarketStatusTracker.tsx" -Raw

foreach ($kind in @(
  "compare_offers",
  "finalize_booking",
  "payment_pending",
  "review_completed",
  "provider_offer_update"
)) {
  if ($route -notmatch [regex]::Escape($kind)) {
    throw "Action absente : $kind"
  }
}

Write-Host "[OK] Actions client + prestataire" -ForegroundColor Green

if ($route -notmatch "priority" -or
    $route -notmatch "actions\.sort") {
  throw "Priorisation absente."
}
Write-Host "[OK] Priorisation serveur" -ForegroundColor Green

if ($page -notmatch "KLYX Action Center" -or
    $page -notmatch "Priorité") {
  throw "Interface Action Center incomplete."
}
Write-Host "[OK] Interface /assistant/actions" -ForegroundColor Green

if ($tracker -notmatch 'href="/assistant/actions"') {
  throw "Lien depuis copilote absent."
}
Write-Host "[OK] Lien copilote -> Action Center" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.34 BUILD VALIDE." -ForegroundColor Green
