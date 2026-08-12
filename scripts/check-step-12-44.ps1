$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.44 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }
$content = Get-Content -LiteralPath $path -Raw

$checks = @(
  @("knownContextSummary", "Resume du contexte"),
  @("questions[missing[0]]", "Question suivante priorisee"),
  @("J’ai déjà compris", "Contexte rappele au client"),
  @("J’ai tout ce qu’il faut", "Etat pret explicite"),
  @("confirme avant que KLYX publie", "Confirmation avant publication"),
  @("const ready = missing.length === 0", "Ready calcule cote serveur")
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
Write-Host "KLYX 12.44 BUILD VALIDE." -ForegroundColor Green
