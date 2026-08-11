$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.31 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "app\api\brain\market-advice\[id]\route.ts",
  "app\assistant\market\[id]\page.tsx",
  "app\requests\page.tsx"
)

foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$route = Get-Content -LiteralPath "app\api\brain\market-advice\[id]\route.ts" -Raw
$page = Get-Content -LiteralPath "app\assistant\market\[id]\page.tsx" -Raw
$requests = Get-Content -LiteralPath "app\requests\page.tsx" -Raw

if ($route -notmatch 'calculateClientOfferRanking') {
  throw "Classement offre non reutilise."
}
Write-Host "[OK] Classement 12.29 reutilise" -ForegroundColor Green

if ($route -notmatch 'KLYX te conseille, mais ne choisit jamais à ta place') {
  throw "Garde-fou decision client absent."
}
Write-Host "[OK] KLYX conseille sans choisir" -ForegroundColor Green

if ($route -notmatch 'isRecommended' -or
    $route -notmatch 'isCheapest') {
  throw "Comparaison recommande/moins cher absente."
}
Write-Host "[OK] Meilleur choix + moins cher compares" -ForegroundColor Green

if ($page -notmatch 'data\.summary' -or
    $page -notmatch 'ranking\.reasons') {
  throw "Explication visuelle absente."
}
Write-Host "[OK] Raisons affichees au client" -ForegroundColor Green

if ($requests -notmatch 'Analyser avec KLYX') {
  throw "CTA analyse absent."
}
Write-Host "[OK] CTA depuis /requests" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.31 BUILD VALIDE." -ForegroundColor Green
