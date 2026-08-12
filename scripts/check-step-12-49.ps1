$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.49 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"

if (-not (Test-Path -LiteralPath $path)) {
  throw "Fichier manquant : $path"
}

$content = Get-Content -LiteralPath $path -Raw

$checks = @(
  @("KLYX_COMPLETENESS_12_49", "Moteur completude"),
  @("completionParts", "Informations comprises"),
  @("completionScore", "Score de completude"),
  @("completionParts.length / 4", "Quatre donnees essentielles"),
  @("Presque prête", "Etat presque pret"),
  @("Demande complète", "Etat demande complete")
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

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.49 BUILD VALIDE." -ForegroundColor Green
