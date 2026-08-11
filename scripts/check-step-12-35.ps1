$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.35 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$pagePath = "app\assistant\page.tsx"
$sidebarPath = "app\ui\AppSidebar.tsx"

foreach ($file in @($pagePath, $sidebarPath)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$page = Get-Content -LiteralPath $pagePath -Raw
$sidebar = Get-Content -LiteralPath $sidebarPath -Raw

if ($page -notmatch 'fetch\(\s*"/api/brain/actions"') {
  throw "Action Center non reutilise."
}
Write-Host "[OK] Priorites KLYX reutilisees" -ForegroundColor Green

if ($page -notmatch 'href="/assistant/market"' -or
    $page -notmatch 'href="/assistant/actions"') {
  throw "Parcours assistant client incomplet."
}
Write-Host "[OK] Demande IA + Action Center" -ForegroundColor Green

if ($page -notmatch 'href="/provider/jobs"' -or
    $page -notmatch 'href="/provider/assistant"') {
  throw "Parcours prestataire incomplet."
}
Write-Host "[OK] Centre KLYX adapte au prestataire" -ForegroundColor Green

$sidebarMatches = [regex]::Matches(
  $sidebar,
  'title: "Centre KLYX", href: "/assistant"'
)

if ($sidebarMatches.Count -ne 2) {
  throw "Centre KLYX doit etre present dans les 2 menus."
}
Write-Host "[OK] Navigation client + prestataire" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.35 BUILD VALIDE." -ForegroundColor Green
