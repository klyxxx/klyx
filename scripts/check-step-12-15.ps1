$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root
Write-Host ""
Write-Host "KLYX 12.15 - VERIFICATION" -ForegroundColor Cyan

$lib = Get-Content -LiteralPath "lib\provider-search.ts" -Raw
$search = Get-Content -LiteralPath "app\search\page.tsx" -Raw
$book = Get-Content -LiteralPath "app\providers\[id]\book\page.tsx" -Raw
$api = Get-Content -LiteralPath "app\api\search\providers\route.ts" -Raw

if ($lib -match 'babysitting|cleaning|moving|handyman') { throw "Metiers fixes encore presents dans provider-search." }
Write-Host "[OK] Liste fixe des 4 metiers supprimee" -ForegroundColor Green
if ($search -notmatch '/api/services/public') { throw "Recherche dynamique absente." }
Write-Host "[OK] Recherche charge les services dynamiques" -ForegroundColor Green
if ($book -match 'SERVICE_LABELS|serviceSlug\s*=.*babysitting') { throw "Fallback baby-sitting encore present." }
Write-Host "[OK] Reservation sans fallback baby-sitting" -ForegroundColor Green
if ($book -notmatch 'select\("id, slug, name"\)') { throw "Nom dynamique du service absent." }
Write-Host "[OK] Reservation charge le vrai nom du service" -ForegroundColor Green
if ($api -notmatch '"rating_desc"') { throw "rating_desc absent de l API." }
Write-Host "[OK] Tri Mieux notes accepte par API" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.15 BUILD VALIDE." -ForegroundColor Green
