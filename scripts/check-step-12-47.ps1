$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.47 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }

$content = Get-Content -LiteralPath $path -Raw

$checks = @(
  @("KLYX_NATURAL_BUDGET_12_47", "Moteur budget naturel"),
  @("budgetPatterns", "Patterns budget"),
  @("pas plus de", "Expression pas plus de"),
  @("maximum", "Expression maximum"),
  @("1000000", "Limite de securite"),
  @("Math.round(amount * 100) / 100", "Montant normalise")
)

foreach ($check in $checks) {
  if (-not $content.Contains($check[0])) {
    throw "$($check[1]) absent."
  }
  Write-Host "[OK] $($check[1])" -ForegroundColor Green
}

Write-Host ""
Write-Host "Verification TypeScript/build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.47 BUILD VALIDE." -ForegroundColor Green
