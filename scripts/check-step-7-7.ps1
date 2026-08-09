$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$requiredFiles = @(
  "app\api\search\providers\route.ts",
  "app\api\quotes\route.ts",
  "app\api\bookings\create\route.ts",
  "app\api\bookings\status\route.ts",
  "app\api\bookings\tracking\route.ts",
  "app\api\stripe\create-checkout-session\route.ts",
  "app\onboarding\page.tsx",
  "app\provider\page.tsx"
)

$missing = @()

foreach ($relative in $requiredFiles) {
  $full = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $full)) {
    $missing += $relative
  }
}

Write-Host ""
Write-Host "KLYX ETAPE 7.7 - PRECHECK CYCLE PRODUCTION" -ForegroundColor Cyan
Write-Host ""

if ($missing.Count -gt 0) {
  Write-Host "ECHEC : fichiers essentiels manquants :" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host " - $_" }
  exit 1
}

$checks = @(
  @{
    File = "app\api\search\providers\route.ts"
    Pattern = "provider_service_zones"
    Label = "Recherche : readiness par zone"
  },
  @{
    File = "app\api\quotes\route.ts"
    Pattern = "provider_service_zones"
    Label = "Devis : zone active"
  },
  @{
    File = "app\api\quotes\route.ts"
    Pattern = 'eq\("is_published", true\)'
    Label = "Devis : profil publie"
  },
  @{
    File = "app\api\bookings\create\route.ts"
    Pattern = "provider_service_zones"
    Label = "Reservation : zone active"
  },
  @{
    File = "app\api\bookings\status\route.ts"
    Pattern = "providerHasConflict"
    Label = "Reservation : conflit de creneau"
  },
  @{
    File = "app\api\bookings\tracking\route.ts"
    Pattern = 'payment_status !== "paid"'
    Label = "Mission : paiement obligatoire"
  },
  @{
    File = "app\api\bookings\tracking\route.ts"
    Pattern = "client_confirmed"
    Label = "Mission : confirmation client"
  },
  @{
    File = "app\api\stripe\create-checkout-session\route.ts"
    Pattern = "claimBookingPayment"
    Label = "Paiement : verrou anti-double paiement"
  }
)

$failed = $false

foreach ($check in $checks) {
  $path = Join-Path $root $check.File
  $found = Select-String `
    -LiteralPath $path `
    -Pattern $check.Pattern `
    -Quiet

  if ($found) {
    Write-Host "[OK] $($check.Label)" -ForegroundColor Green
  }
  else {
    Write-Host "[MANQUANT] $($check.Label)" -ForegroundColor Red
    $failed = $true
  }
}

Write-Host ""

if ($failed) {
  Write-Host "PRECHECK 7.7 NON VALIDE." -ForegroundColor Red
  Write-Host "N'envoie pas encore en production."
  exit 1
}

Write-Host "PRECHECK 7.7 VALIDE." -ForegroundColor Green
Write-Host "Les protections structurelles du cycle sont presentes."
Write-Host ""
Write-Host "Etape suivante : npm run build"
Write-Host "Puis execute la checklist : docs\STEP-7-7-PRODUCTION-CYCLE.md"
