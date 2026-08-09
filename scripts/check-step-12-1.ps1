$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.1 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "app\api\provider\studio\route.ts",
  "app\components\ProviderStudio.tsx",
  "app\api\search\providers\route.ts",
  "app\search\page.tsx",
  "lib\provider-studio.ts",
  "app\globals.css",
  "supabase\migrations\20260809_step_12_1_pricing.sql"
)

foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $file))) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.1 BUILD VALIDE." -ForegroundColor Green
