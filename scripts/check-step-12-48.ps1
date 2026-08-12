$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.48 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }
$content = Get-Content -LiteralPath $path -Raw

$checks = @(
  @("KLYX_AMBIGUITY_12_48", "Moteur ambiguite"),
  @("firstMissing", "Priorite information manquante"),
  @("guidedQuestions", "Questions guidees"),
  @("même si tu ne connais pas le nom exact du métier", "Description libre du besoin"),
  @("knownContextSummary", "Contexte conserve"),
  @("missing[0]", "Une question a la fois")
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
Write-Host "KLYX 12.48 BUILD VALIDE." -ForegroundColor Green
