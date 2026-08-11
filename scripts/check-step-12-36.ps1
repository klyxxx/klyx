$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.36 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$badgePath = "app\components\AssistantPriorityBadge.tsx"
$sidebarPath = "app\ui\AppSidebar.tsx"

foreach ($file in @(
  $badgePath,
  $sidebarPath
)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$badge = Get-Content -LiteralPath $badgePath -Raw
$sidebar = Get-Content -LiteralPath $sidebarPath -Raw

if ($badge -notmatch 'fetch\("/api/brain/actions"') {
  throw "Badge non relie a Action Center."
}
Write-Host "[OK] Badge relie a /api/brain/actions" -ForegroundColor Green

if ($badge -notmatch '30000') {
  throw "Refresh 30 secondes absent."
}
Write-Host "[OK] Actualisation 30 secondes" -ForegroundColor Green

if ($badge -notmatch 'priority\) >= 95' -and
    $badge -notmatch 'priority\) >=\s*95') {
  throw "Detection priorite urgente absente."
}
Write-Host "[OK] Priorites urgentes detectees" -ForegroundColor Green

if ($sidebar -notmatch 'AssistantPriorityBadge') {
  throw "Badge absent de AppSidebar."
}

if ($sidebar -notmatch 'item\.href === "/assistant"') {
  throw "Badge non limite au Centre KLYX."
}
Write-Host "[OK] Badge visible sur Centre KLYX" -ForegroundColor Green

$centerCount = ([regex]::Matches(
  $sidebar,
  'title: "Centre KLYX", href: "/assistant"'
)).Count

if ($centerCount -ne 2) {
  throw "Centre KLYX doit rester present dans les 2 menus."
}
Write-Host "[OK] Navigation client + prestataire conservee" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.36 BUILD VALIDE." -ForegroundColor Green
