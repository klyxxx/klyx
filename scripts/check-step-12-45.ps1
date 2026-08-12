$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.45 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }
$content = Get-Content -LiteralPath $path -Raw

$checks = @(
  @("KLYX_WEEKDAY_12_45", "Moteur jours naturels"),
  @('aliases: ["lundi"]', "Lundi"),
  @('aliases: ["samedi"]', "Samedi"),
  @('aliases: ["dimanche"]', "Dimanche"),
  @("daysAhead", "Calcul prochain jour"),
  @('value.includes("demain")', "Demain conserve"),
  @("numericMatch", "Date numerique conservee")
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
Write-Host "KLYX 12.45 BUILD VALIDE." -ForegroundColor Green
