$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.14 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$lib = Get-Content -LiteralPath "lib\provider-search.ts" -Raw
$route = Get-Content -LiteralPath "app\api\search\providers\route.ts" -Raw

if ($lib -notmatch 'rating: number;') { throw "rating absent de ProviderSearchItem." }
Write-Host "[OK] rating dans ProviderSearchItem" -ForegroundColor Green

if ($lib -notmatch 'reviewCount: number;') { throw "reviewCount absent de ProviderSearchItem." }
Write-Host "[OK] reviewCount dans ProviderSearchItem" -ForegroundColor Green

if ($lib -notmatch '"rating_desc"') { throw "Tri Mieux notes absent." }
Write-Host "[OK] Tri Mieux notes" -ForegroundColor Green

if ($route -notmatch 'rating, review_count') { throw "Colonnes reputation absentes de l API recherche." }
Write-Host "[OK] API charge rating + review_count" -ForegroundColor Green

if ($route -notmatch 'reviewCount: Number\(serviceProfile\.review_count') { throw "reviewCount absent des resultats." }
Write-Host "[OK] Reputation retournee dans chaque resultat" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.14 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
