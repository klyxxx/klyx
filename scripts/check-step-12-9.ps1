$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.9 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$globals = Get-Content .\app\globals.css -Raw
$logo = Get-Content .\app\ui\KlyxLogo.tsx -Raw
$sidebar = Get-Content .\app\ui\AppSidebar.tsx -Raw
$select = Get-Content .\app\components\KlyxSelect.tsx -Raw

if ($globals -notmatch "KLYX 12\.9 - GLOBAL LIGHT MODE") { throw "Couche 12.9 absente." }
if ($logo -notmatch "text-zinc-950 dark:text-white") { throw "Logo non theme-aware." }
if ($sidebar -notmatch "text-muted-foreground") { throw "Sidebar non migree." }
if ($select -notmatch "bg-background") { throw "KlyxSelect non migre." }

Write-Host "[OK] Global theme" -ForegroundColor Green
Write-Host "[OK] Logo" -ForegroundColor Green
Write-Host "[OK] Sidebar" -ForegroundColor Green
Write-Host "[OK] KlyxSelect" -ForegroundColor Green

Write-Host ""
npm run build

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.9 BUILD VALIDE." -ForegroundColor Green
