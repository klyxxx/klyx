$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.34 - AI ACTION CENTER" -ForegroundColor Cyan
Write-Host ""

foreach ($relative in @(
  "app\api\brain\actions\route.ts",
  "app\assistant\actions\page.tsx",
  "app\assistant\market\[id]\MarketStatusTracker.tsx"
)) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Payload manquant : $relative"
  }

  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  Write-Host "[OK] $relative" -ForegroundColor Green
}

Write-Host "[OK] Centre actions client + prestataire" -ForegroundColor Green
Write-Host "[OK] Priorites calculees cote serveur" -ForegroundColor Green
Write-Host "[OK] Lien depuis le copilote marche" -ForegroundColor Green
Write-Host ""
Write-Host "12.34 appliquee. Aucune migration SQL." -ForegroundColor Cyan
