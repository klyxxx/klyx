$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.38 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$briefPath = "app\components\AssistantBrief.tsx"
$pagePath = "app\assistant\page.tsx"

foreach ($file in @($briefPath, $pagePath)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$brief = Get-Content -LiteralPath $briefPath -Raw
$page = Get-Content -LiteralPath $pagePath -Raw

if ($brief -notmatch 'fetch\("/api/brain/actions"') {
  throw "Brief non relie a /api/brain/actions."
}
Write-Host "[OK] Brief relie aux actions KLYX" -ForegroundColor Green

if ($brief -notmatch 'priority >= 95') {
  throw "Urgences absentes du brief."
}
Write-Host "[OK] Urgences visibles" -ForegroundColor Green

if ($brief -notmatch 'first\.href' -or $brief -notmatch 'first\.label') {
  throw "CTA prochaine action absent."
}
Write-Host "[OK] CTA prochaine action dynamique" -ForegroundColor Green

if ($brief -notmatch '30000') {
  throw "Actualisation automatique absente."
}
Write-Host "[OK] Actualisation 30 secondes" -ForegroundColor Green

if ($page -notmatch '<AssistantBrief') {
  throw "AssistantBrief absent de /assistant."
}
Write-Host "[OK] Brief visible dans le hero" -ForegroundColor Green

if ($page -notmatch '<ProactiveAssistantPanel') {
  throw "Assistant proactif 12.37 perdu."
}
Write-Host "[OK] Assistant proactif 12.37 conserve" -ForegroundColor Green

Write-Host ""
Write-Host "Verification TypeScript/build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.38 BUILD VALIDE." -ForegroundColor Green
