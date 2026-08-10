$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.10C - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$visual = Get-Content -LiteralPath "app\klyx-visual-system.css" -Raw
$favorites = Get-Content -LiteralPath "app\favorites\page.tsx" -Raw
$search = Get-Content -LiteralPath "app\search\page.tsx" -Raw
$sidebar = Get-Content -LiteralPath "app\ui\AppSidebar.tsx" -Raw

if ($visual -notmatch '\.dark \.klyx-app-content article\[class\*="bg-zinc-900"\]') {
  throw "Visual system sombre non scope au dark mode."
}
Write-Host "[OK] Ancien gradient sombre uniquement en dark" -ForegroundColor Green

if ($visual -notmatch 'html:not\(\.dark\).*dark:bg-zinc-900') {
  throw "Fallback clair des anciennes cartes absent."
}
Write-Host "[OK] Cartes legacy claires en light mode" -ForegroundColor Green

if ($favorites -notmatch 'bg-violet-600[^"]*text-white') {
  throw "CTA favoris sans texte blanc."
}
Write-Host "[OK] CTA Favoris" -ForegroundColor Green

if ($search -notmatch 'Rechercher les prestataires') {
  throw "Search invalide."
}
if ($search -notmatch 'bg-violet-600[^"]*text-white') {
  throw "CTA Search sans texte blanc."
}
Write-Host "[OK] Search" -ForegroundColor Green

if ($sidebar -notmatch 'bg-card text-foreground dark:border-white/8') {
  throw "Sidebar desktop non theme-aware."
}
Write-Host "[OK] Sidebar desktop" -ForegroundColor Green

if ($sidebar -notmatch 'w-\[min\(88vw,330px\)\].*bg-card.*dark:bg-\[linear-gradient') {
  throw "Sidebar mobile non theme-aware."
}
Write-Host "[OK] Sidebar mobile" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.10C BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
