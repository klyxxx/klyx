$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.23 - ONBOARDING PRESTATAIRE PRO" -ForegroundColor Cyan

$source = Join-Path $payload "app\onboarding\ProviderOnboardingProgress.tsx"
$target = Join-Path $root "app\onboarding\ProviderOnboardingProgress.tsx"

if (-not (Test-Path -LiteralPath $source)) {
  throw "Payload ProviderOnboardingProgress manquant."
}

Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host "[OK] ProviderOnboardingProgress remplace" -ForegroundColor Green
Write-Host "[OK] 8 etapes prestataire" -ForegroundColor Green
Write-Host "[OK] Studio + zones + verification + Stripe" -ForegroundColor Green
Write-Host ""
Write-Host "12.23 appliquee. Aucune migration SQL." -ForegroundColor Cyan
