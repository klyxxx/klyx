$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX ETAPE 11.5 - FOUNDER GLOBAL" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "app\components\FounderAccessBar.tsx",
  "app\layout.tsx",
  "lib\founder-auth.ts"
)

$failed = $false

foreach ($file in $required) {
  if (Test-Path -LiteralPath (Join-Path $root $file)) {
    Write-Host "[OK] $file" -ForegroundColor Green
  }
  else {
    Write-Host "[ECHEC] $file" -ForegroundColor Red
    $failed = $true
  }
}

$envFile = Join-Path $root ".env.local"

if (
  (Test-Path -LiteralPath $envFile) -and
  (
    (Get-Content -LiteralPath $envFile -Raw) -match
    "(?m)^KLYX_FOUNDER_USER_IDS=.+$"
  )
) {
  Write-Host "[OK] KLYX_FOUNDER_USER_IDS configure" -ForegroundColor Green
}
else {
  Write-Host "[ECHEC] KLYX_FOUNDER_USER_IDS absent" -ForegroundColor Red
  $failed = $true
}

if ($failed) {
  Write-Host ""
  Write-Host "PRECHECK 11.5 NON VALIDE." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

& npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 11.5 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Teste plusieurs pages avec le compte Founder." -ForegroundColor Cyan
