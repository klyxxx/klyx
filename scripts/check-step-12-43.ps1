$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.43 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$path = "app\assistant\market\page.tsx"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }
$content = Get-Content -LiteralPath $path -Raw

$checks = @(
  @("useRef", "Protection autostart"),
  @("autoStartRef", "Autostart unique"),
  @("KLYX_AUTOSTART_12_43", "Analyse automatique"),
  @("requestSubmit", "Soumission automatique"),
  @('data-klyx-market-form="true"', "Formulaire cible"),
  @("confirmed: true", "Confirmation explicite conservee"),
  @("market-publish", "Publication existante conservee")
)

foreach ($check in $checks) {
  if ($content -notmatch [regex]::Escape($check[0])) {
    throw "$($check[1]) absent."
  }
  Write-Host "[OK] $($check[1])" -ForegroundColor Green
}

Write-Host ""
Write-Host "Verification TypeScript/build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.43 BUILD VALIDE." -ForegroundColor Green
