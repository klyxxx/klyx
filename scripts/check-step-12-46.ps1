$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.46 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }
$content = Get-Content -LiteralPath $path -Raw

$checks = @(
  @("KLYX_NATURAL_TIME_12_46", "Moteur heures naturelles"),
  @('"midi"', "Midi"),
  @('"minuit"', "Minuit"),
  @('"le matin"', "Matin"),
  @('"l apres midi"', "Apres-midi"),
  @('"le soir"', "Soir"),
  @("const match = value.match", "Heure numerique conservee")
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
Write-Host "KLYX 12.46 BUILD VALIDE." -ForegroundColor Green
