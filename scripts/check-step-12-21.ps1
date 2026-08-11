$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.21 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$path = "app\\settings\\page.tsx"
$content = Get-Content -LiteralPath $path -Raw

if ($content -match '<input\\s+type="checkbox"') {
  throw "Checkbox native encore presente dans Settings."
}
Write-Host "[OK] Aucun checkbox natif dans Settings" -ForegroundColor Green

if ($content -notmatch 'role="switch"') {
  throw "Switch accessible absent."
}
Write-Host "[OK] role=switch" -ForegroundColor Green

if (-not $content.Contains('aria-checked={enabled}')) {
  throw "aria-checked absent."
}
Write-Host "[OK] aria-checked" -ForegroundColor Green

if ($content -notmatch 'Confirmations, changements de statut') {
  throw "Descriptions notifications absentes."
}
Write-Host "[OK] Descriptions notifications" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.21 BUILD VALIDE." -ForegroundColor Green
