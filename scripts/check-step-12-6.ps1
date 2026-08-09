$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.6 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$apiPath = "app\api\founder\test-center\route.ts"
$pagePath = "app\founder\test\page.tsx"

foreach ($file in @($apiPath, $pagePath)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$api = Get-Content -LiteralPath $apiPath -Raw
$page = Get-Content -LiteralPath $pagePath -Raw

$checks = @(
  @{
    Label = "Version 12.6"
    Pattern = 'version:\s*"12\.6"'
  },
  @{
    Label = "Parcours Client Prestataire"
    Pattern = '"beta-client-provider"'
  },
  @{
    Label = "Parcours Prestataire"
    Pattern = '"beta-provider-ready"'
  },
  @{
    Label = "Barriere securite"
    Pattern = '"beta-security-gate"'
  },
  @{
    Label = "Barriere paiement"
    Pattern = '"beta-payment-gate"'
  },
  @{
    Label = "Audit RLS conserve"
    Pattern = '"security-rls"'
  },
  @{
    Label = "Favoris conserves"
    Pattern = '"favorites-table"'
  },
  @{
    Label = "Reservations conservees"
    Pattern = '"bookings"'
  },
  @{
    Label = "Devis conserves"
    Pattern = '"quotes"'
  },
  @{
    Label = "Stripe conserve"
    Pattern = '"stripe-runtime"'
  }
)

foreach ($check in $checks) {
  if ($api -notmatch $check.Pattern) {
    throw "[ECHEC] $($check.Label)"
  }

  Write-Host "[OK] $($check.Label)" -ForegroundColor Green
}

if ($page -notmatch '12\.6') {
  throw "[ECHEC] Badge visible Test Center 12.6 absent."
}

Write-Host "[OK] Badge visible 12.6" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.6 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Apres deploiement :" -ForegroundColor Cyan
Write-Host "https://klyx-ten.vercel.app/founder/test" -ForegroundColor White
Write-Host "Puis clique : Relancer les tests" -ForegroundColor White
