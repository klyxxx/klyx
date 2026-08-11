$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.37 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$componentPath = "app\components\ProactiveAssistantPanel.tsx"
$pagePath = "app\assistant\page.tsx"

foreach ($file in @($componentPath, $pagePath)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$component = Get-Content -LiteralPath $componentPath -Raw
$page = Get-Content -LiteralPath $pagePath -Raw

if ($component -notmatch 'fetch\("/api/brain/actions"') {
  throw "Assistant proactif non relie aux actions."
}
Write-Host "[OK] Reutilise /api/brain/actions" -ForegroundColor Green

if ($component -notmatch "Pourquoi maintenant") {
  throw "Explication proactive absente."
}
Write-Host "[OK] Explique pourquoi agir maintenant" -ForegroundColor Green

if ($component -notmatch "priority >= 95") {
  throw "Priorite urgente absente."
}
Write-Host "[OK] Priorites urgentes mises en avant" -ForegroundColor Green

if ($component -notmatch "ne déclenche jamais un paiement" -or
    $component -notmatch "sans ta confirmation") {
  throw "Garde-fous utilisateur incomplets."
}
Write-Host "[OK] Garde-fous confirmation" -ForegroundColor Green

if ($component -notmatch "30000") {
  throw "Refresh automatique absent."
}
Write-Host "[OK] Actualisation automatique 30 secondes" -ForegroundColor Green

if ($page -notmatch "ProactiveAssistantPanel") {
  throw "Assistant proactif absent de /assistant."
}
Write-Host "[OK] Visible dans /assistant" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.37 BUILD VALIDE." -ForegroundColor Green
