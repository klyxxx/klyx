$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.24 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "supabase\migrations\20260811_step_12_24_open_requests_offers.sql",
  "app\api\market\requests\route.ts",
  "app\api\market\requests\[id]\offers\route.ts",
  "app\requests\page.tsx",
  "app\provider\jobs\page.tsx"
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$sidebar = Get-Content -LiteralPath "app\ui\AppSidebar.tsx" -Raw
if ($sidebar -notmatch 'href: "/requests"') { throw "Navigation client absente." }
if ($sidebar -notmatch 'href: "/provider/jobs"') { throw "Navigation prestataire absente." }

Write-Host "[OK] Navigation visible" -ForegroundColor Green

$sql = Get-Content -LiteralPath "supabase\migrations\20260811_step_12_24_open_requests_offers.sql" -Raw
if ($sql -notmatch 'market_service_requests' -or $sql -notmatch 'market_service_offers') {
  throw "Tables 12.24 absentes de la migration."
}
Write-Host "[OK] Demandes + offres SQL" -ForegroundColor Green

$api = Get-Content -LiteralPath "app\api\market\requests\route.ts" -Raw
$offersApi = Get-Content -LiteralPath "app\api\market\requests\[id]\offers\route.ts" -Raw

if ($api -notmatch 'requireAccountType\(profile, "client"\)') {
  throw "Protection client absente."
}
if ($offersApi -notmatch 'requireAccountType\(profile, "provider"\)') {
  throw "Protection prestataire absente."
}
Write-Host "[OK] Roles client/prestataire proteges" -ForegroundColor Green

if ($offersApi -notmatch 'accepted_offer_id' -or $offersApi -notmatch 'status: "matched"') {
  throw "Acceptation d'offre incomplete."
}
Write-Host "[OK] Acceptation d'offre + attribution" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.24 BUILD VALIDE." -ForegroundColor Green
