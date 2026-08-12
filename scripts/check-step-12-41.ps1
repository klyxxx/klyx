$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.41 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$componentPath = "app\components\AssistantCommandBar.tsx"
$pagePath = "app\assistant\page.tsx"

foreach ($file in @($componentPath, $pagePath)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$component = Get-Content -LiteralPath $componentPath -Raw
$page = Get-Content -LiteralPath $pagePath -Raw

if ($component -notmatch '/assistant/market\?') {
  throw "Handoff vers assistant market absent."
}
Write-Host "[OK] Demande texte -> assistant market" -ForegroundColor Green

if ($component -notmatch '/request/photo') {
  throw "Recherche photo absente."
}
Write-Host "[OK] Recherche par photo accessible" -ForegroundColor Green

if ($component -notmatch 'EXAMPLES') {
  throw "Exemples rapides absents."
}
Write-Host "[OK] Exemples de besoins rapides" -ForegroundColor Green

if ($page -notmatch '<AssistantCommandBar') {
  throw "Command bar absente de /assistant."
}
Write-Host "[OK] Command bar visible dans Centre KLYX" -ForegroundColor Green

if ($page -notmatch '<AssistantBrief') {
  throw "Brief 12.38 perdu."
}
Write-Host "[OK] Brief KLYX conserve" -ForegroundColor Green

if ($page -notmatch '<ProactiveAssistantPanel') {
  throw "Assistant proactif perdu."
}
Write-Host "[OK] Assistant proactif conserve" -ForegroundColor Green

Write-Host ""
Write-Host "Verification TypeScript/build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.41 BUILD VALIDE." -ForegroundColor Green
