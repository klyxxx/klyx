$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.32 - AI ASSISTED SELECTION" -ForegroundColor Cyan
Write-Host ""

$relative = "app\assistant\market\[id]\page.tsx"
$source = Join-Path $payload $relative
$target = Join-Path $root $relative

if (-not (Test-Path -LiteralPath $source)) {
  throw "Payload manquant : $relative"
}

Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host "[OK] Conseiller KLYX peut preparer le choix" -ForegroundColor Green
Write-Host "[OK] Confirmation explicite obligatoire" -ForegroundColor Green
Write-Host "[OK] Reutilise l'API transactionnelle des offres" -ForegroundColor Green
Write-Host "[OK] Redirection vers finalisation booking" -ForegroundColor Green
Write-Host ""
Write-Host "12.32 appliquee. Aucune migration SQL." -ForegroundColor Cyan
