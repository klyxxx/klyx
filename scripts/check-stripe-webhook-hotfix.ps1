$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX - STRIPE WEBHOOK HOTFIX" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "app\api\stripe\webhook\route.ts",
  "app\api\admin\stripe-webhook-health\route.ts",
  "lib\stripe-webhook-events.ts"
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$webhook = Get-Content -LiteralPath "app\api\stripe\webhook\route.ts" -Raw

if ($webhook -match "assertStripeRuntimeReady") {
  throw "Le webhook dépend encore de assertStripeRuntimeReady()."
}
Write-Host "[OK] Webhook indépendant du readiness global" -ForegroundColor Green

if ($webhook -notmatch "request\.text\(\)") {
  throw "Lecture du corps brut Stripe absente."
}
Write-Host "[OK] Corps brut utilisé pour la signature Stripe" -ForegroundColor Green

if ($webhook -notmatch "claimStripeWebhookEvent") {
  throw "Protection anti-doublon absente."
}
Write-Host "[OK] Protection anti-doublon conservée" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "STRIPE WEBHOOK HOTFIX BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
