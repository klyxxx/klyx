$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.25 - OFFRE -> DEVIS -> RESERVATION" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "supabase\migrations\20260811_step_12_25_market_to_booking.sql",
  "app\api\market\requests\route.ts",
  "app\api\market\requests\[id]\offers\route.ts",
  "app\requests\page.tsx"
)

foreach ($relative in $files) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Payload manquant : $relative"
  }

  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force

  Write-Host "[OK] $relative" -ForegroundColor Green
}

Write-Host ""
Write-Host "12.25 appliquee." -ForegroundColor Cyan
Write-Host "IMPORTANT : executer la migration SQL avant le test fonctionnel." -ForegroundColor Yellow
