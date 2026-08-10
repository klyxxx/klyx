$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.16 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$globals = Get-Content -LiteralPath "app\globals.css" -Raw
$select = Get-Content -LiteralPath "app\components\KlyxSelect.tsx" -Raw
$sidebar = Get-Content -LiteralPath "app\ui\AppSidebar.tsx" -Raw

if ($globals -notmatch "KLYX 12\.16 - CANONICAL MOBILE \+ LIGHT/DARK") {
  throw "Couche CSS 12.16 absente."
}
Write-Host "[OK] Couche theme finale" -ForegroundColor Green

if ($globals -notmatch 'input\[type="date"\]::-webkit-date-and-time-value') {
  throw "Protection date Safari absente."
}
if ($globals -notmatch 'input\[type="time"\]::-webkit-date-and-time-value') {
  throw "Protection time Safari absente."
}
Write-Host "[OK] Date/heure Safari mobile" -ForegroundColor Green

if ($select -match 'selected\s*\?\s*"bg-gradient-to-r.*text-white"') {
  throw "Ancien KlyxSelect dark-only detecte."
}
if ($select -notmatch 'bg-muted text-foreground dark:bg-white') {
  throw "KlyxSelect theme-aware incomplet."
}
Write-Host "[OK] KlyxSelect clair/sombre" -ForegroundColor Green

if ($sidebar -notmatch 'hover:bg-muted dark:hover:bg-white/7') {
  throw "Sidebar clair/sombre non corrigee."
}
Write-Host "[OK] Sidebar clair/sombre" -ForegroundColor Green

Write-Host ""
Write-Host "AUDIT INFORMATIF DES CLASSES LEGACY" -ForegroundColor Yellow

$legacy = Get-ChildItem .\app -Recurse -File -Include *.tsx,*.ts |
  Select-String -Pattern 'bg-zinc-950|bg-zinc-900|text-white|text-zinc-300|text-zinc-400' |
  Where-Object { $_.Line -notmatch 'dark:' } |
  Select-Object -First 25

if ($legacy) {
  Write-Host "[INFO] Quelques classes non-theme restent dans des composants colores ou legacy." -ForegroundColor Yellow
  $legacy | ForEach-Object {
    Write-Host " - $($_.Path):$($_.LineNumber)" -ForegroundColor DarkYellow
  }
}
else {
  Write-Host "[OK] Aucun legacy evident hors dark:" -ForegroundColor Green
}

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.16 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
