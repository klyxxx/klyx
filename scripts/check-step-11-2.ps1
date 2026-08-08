$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX ETAPE 11.2 - VALIDATION FOUNDER" -ForegroundColor Cyan
Write-Host ""

$failed = $false

function Ok([string]$Message) {
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Fail([string]$Message) {
  Write-Host "[ECHEC] $Message" -ForegroundColor Red
  $script:failed = $true
}

function Check-File(
  [string]$Path,
  [string]$Label
) {
  if (Test-Path -LiteralPath (Join-Path $root $Path)) {
    Ok $Label
  }
  else {
    Fail $Label
  }
}

Check-File "app\founder\page.tsx" "Console Founder"
Check-File "app\founder\test\page.tsx" "Test Founder"
Check-File "app\api\founder\status\route.ts" "API Founder"
Check-File "lib\founder-auth.ts" "Sécurité Founder"
Check-File "lib\admin-auth.ts" "Sécurité Admin"

$envFile = Join-Path $root ".env.local"

if (Test-Path -LiteralPath $envFile) {
  $envContent = Get-Content -LiteralPath $envFile -Raw

  if ($envContent -match "(?m)^KLYX_FOUNDER_USER_IDS=.+$") {
    Ok "KLYX_FOUNDER_USER_IDS configuré"
  }
  else {
    Fail "KLYX_FOUNDER_USER_IDS absent de .env.local"
  }
}
else {
  Fail ".env.local introuvable"
}

if ($failed) {
  Write-Host ""
  Write-Host "PRECHECK 11.2 NON VALIDE." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "PRECHECK FICHIERS VALIDE." -ForegroundColor Green
Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

& npm run build

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "BUILD 11.2 ECHEC." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 11.2 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Teste maintenant : /founder/test" -ForegroundColor Cyan
