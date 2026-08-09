$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.8 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$search = Get-Content -LiteralPath "app\search\page.tsx" -Raw
$css = Get-Content -LiteralPath "app\globals.css" -Raw

if ($search -notmatch "bg-background") { throw "Search n'utilise pas bg-background" }
if ($search -notmatch "text-foreground") { throw "Search n'utilise pas text-foreground" }
if ($search -notmatch "min-w-0") { throw "Protection mobile min-w-0 absente" }
if ($css -notmatch "color-scheme:\s*light") { throw "Mode clair absent" }
if ($css -notmatch "input\[type=""date""\]") { throw "Protection date absente" }
if ($css -notmatch "input\[type=""time""\]") { throw "Protection time absente" }

Write-Host "[OK] Theme clair" -ForegroundColor Green
Write-Host "[OK] Theme sombre" -ForegroundColor Green
Write-Host "[OK] Mobile date/heure" -ForegroundColor Green
Write-Host "[OK] Anti-debordement" -ForegroundColor Green

Write-Host ""
npm run build

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.8 BUILD VALIDE." -ForegroundColor Green
