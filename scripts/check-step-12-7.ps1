$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.7 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$searchPath = "app\search\page.tsx"
$bookingPath = "app\providers\[id]\book\page.tsx"

foreach ($file in @($searchPath, $bookingPath)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$search = Get-Content -LiteralPath $searchPath -Raw
$booking = Get-Content -LiteralPath $bookingPath -Raw

$checks = @(
  @{ Label = "Recherche start"; Text = $search; Pattern = 'draft\.startTime' },
  @{ Label = "Recherche end"; Text = $search; Pattern = 'draft\.endTime' },
  @{ Label = "URL booking start"; Text = $search; Pattern = 'params\.set\("start"' },
  @{ Label = "URL booking end"; Text = $search; Pattern = 'params\.set\("end"' },
  @{ Label = "Filtres avances"; Text = $search; Pattern = 'Filtres avancés' },
  @{ Label = "Booking lit start"; Text = $booking; Pattern = 'searchParams\.get\("start"\)' },
  @{ Label = "Booking lit end"; Text = $booking; Pattern = 'searchParams\.get\("end"\)' },
  @{ Label = "Validation disponibilite"; Text = $booking; Pattern = 'fitsAvailability' },
  @{ Label = "Validation creneau"; Text = $booking; Pattern = 'Le créneau choisi n''est pas valide' }
)

foreach ($check in $checks) {
  if ($check.Text -notmatch $check.Pattern) {
    throw "[ECHEC] $($check.Label)"
  }
  Write-Host "[OK] $($check.Label)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.7 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "TEST MANUEL :" -ForegroundColor Yellow
Write-Host "1. /search" -ForegroundColor White
Write-Host "2. Choisir date + debut + fin" -ForegroundColor White
Write-Host "3. Rechercher" -ForegroundColor White
Write-Host "4. Cliquer Reserver" -ForegroundColor White
Write-Host "5. Verifier que date/debut/fin sont deja remplis" -ForegroundColor White
