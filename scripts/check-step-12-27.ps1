$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.27 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "supabase\migrations\20260811_step_12_27_market_notifications.sql",
  "lib\market-notifications.ts",
  "app\api\market\requests\route.ts",
  "app\api\market\requests\[id]\offers\route.ts",
  "app\notifications\page.tsx"
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$requests = Get-Content -LiteralPath "app\api\market\requests\route.ts" -Raw
$offers = Get-Content -LiteralPath "app\api\market\requests\[id]\offers\route.ts" -Raw
$notifications = Get-Content -LiteralPath "app\notifications\page.tsx" -Raw
$sql = Get-Content -LiteralPath "supabase\migrations\20260811_step_12_27_market_notifications.sql" -Raw

if ($requests -notmatch 'notifyCompatibleProviders') {
  throw "Notification prestataires compatibles absente."
}
Write-Host "[OK] Nouvelle demande -> prestataires compatibles" -ForegroundColor Green

if ($offers -notmatch 'Nouvelle offre reçue') {
  throw "Notification nouvelle offre absente."
}
Write-Host "[OK] Nouvelle offre -> client" -ForegroundColor Green

if ($offers -notmatch 'Offre acceptée' -or $offers -notmatch 'Offre non retenue') {
  throw "Notifications acceptation/refus absentes."
}
Write-Host "[OK] Acceptation/refus -> prestataire" -ForegroundColor Green

if ($notifications -match 'getActiveClientProfile') {
  throw "Notifications encore limitees au client."
}

if ($notifications -notmatch '/api/profiles/active') {
  throw "Profil actif generique absent."
}
Write-Host "[OK] Centre notifications multi-profils" -ForegroundColor Green

if ($sql -notmatch 'market_request_id' -or $sql -notmatch 'booking_id drop not null') {
  throw "Migration notifications generiques incomplete."
}
Write-Host "[OK] Notifications supportent les demandes marche" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.27 BUILD VALIDE." -ForegroundColor Green
