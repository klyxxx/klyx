$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.11 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$apiPath = "app\api\reviews\route.ts"
$pagePath = "app\reviews\[bookingId]\page.tsx"

foreach ($file in @($apiPath, $pagePath)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$api = Get-Content -LiteralPath $apiPath -Raw
$page = Get-Content -LiteralPath $pagePath -Raw

if ($api -notmatch 'provider_id.*babysitter_id') {
  throw "Fallback provider_id/babysitter_id absent."
}
Write-Host "[OK] Tous les prestataires, plus seulement baby-sitter" -ForegroundColor Green

if ($api -notmatch 'status !== "completed"') {
  throw "Verification mission terminee absente."
}
Write-Host "[OK] Avis reserve aux missions terminees" -ForegroundColor Green

if ($api -notmatch 'getAuthenticatedProfile') {
  throw "Authentification serveur absente."
}
Write-Host "[OK] Authentification serveur" -ForegroundColor Green

if ($page -match 'from\("reviews"\)') {
  throw "La page ecrit encore directement dans Supabase."
}
Write-Host "[OK] Aucun ecriture directe reviews depuis le navigateur" -ForegroundColor Green

if ($page -match '/babysitters/') {
  throw "Ancienne redirection baby-sitter encore presente."
}
Write-Host "[OK] Redirection generique /providers" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.11 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
