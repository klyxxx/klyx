$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.30 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "app\assistant\market\page.tsx",
  "app\api\brain\market-publish\route.ts",
  "app\requests\page.tsx"
)

foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$page = Get-Content -LiteralPath "app\assistant\market\page.tsx" -Raw
$route = Get-Content -LiteralPath "app\api\brain\market-publish\route.ts" -Raw
$requests = Get-Content -LiteralPath "app\requests\page.tsx" -Raw

if ($page -notmatch 'fetch\(\s*"/api/brain/respond"') {
  throw "Assistant non relie au Brain."
}
Write-Host "[OK] Assistant utilise KLYX Brain" -ForegroundColor Green

if ($page -notmatch 'confirmed: true') {
  throw "Confirmation client absente."
}

if ($route -notmatch 'body\.confirmed !== true') {
  throw "Protection serveur confirmation absente."
}
Write-Host "[OK] Confirmation explicite client + serveur" -ForegroundColor Green

if ($route -notmatch 'market_service_requests') {
  throw "Publication marche absente."
}
Write-Host "[OK] Assistant publie dans le marche existant" -ForegroundColor Green

if ($route -notmatch 'notifyCompatibleProviders') {
  throw "Notifications prestataires absentes."
}
Write-Host "[OK] Prestataires compatibles avertis" -ForegroundColor Green

if ($requests -notmatch 'href="/assistant/market"') {
  throw "CTA assistant absent de /requests."
}
Write-Host "[OK] CTA assistant visible" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.30 BUILD VALIDE." -ForegroundColor Green
