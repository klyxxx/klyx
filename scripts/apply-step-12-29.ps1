$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.29 - SMART CLIENT CHOICE" -ForegroundColor Cyan
Write-Host ""

foreach ($relative in @(
  "lib\client-offer-ranking.ts",
  "app\api\market\requests\route.ts",
  "app\requests\page.tsx"
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

Write-Host ""
Write-Host "12.29 appliquee. Aucune migration SQL." -ForegroundColor Cyan
