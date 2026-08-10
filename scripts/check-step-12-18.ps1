$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.18 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$required = @(
  "app\legal\page.tsx",
  "app\privacy\page.tsx",
  "app\terms\page.tsx",
  "app\support\page.tsx",
  "app\delete-account\page.tsx",
  "lib\klyx-public-config.ts"
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$settings = Get-Content -LiteralPath "app\settings\page.tsx" -Raw
$sidebar = Get-Content -LiteralPath "app\ui\AppSidebar.tsx" -Raw
$deletion = Get-Content -LiteralPath "app\delete-account\page.tsx" -Raw
$privacy = Get-Content -LiteralPath "app\privacy\page.tsx" -Raw

if ($settings -notmatch 'Confidentialité et assistance') {
  throw "Liens légaux absents des paramètres."
}
Write-Host "[OK] Confidentialité accessible dans l'app" -ForegroundColor Green

if ($deletion -notmatch 'Demande depuis le web') {
  throw "Demande de suppression web absente."
}
Write-Host "[OK] Suppression accessible hors application" -ForegroundColor Green

if ($privacy -notmatch 'Conservation' -or $privacy -notmatch 'Suppression') {
  throw "Politique de confidentialité incomplète."
}
Write-Host "[OK] Conservation + suppression documentées" -ForegroundColor Green

foreach ($route in @("/privacy", "/terms", "/support", "/delete-account")) {
  if ($sidebar -notmatch [regex]::Escape("`"$route`"")) {
    throw "Route publique absente de routesWithoutSidebar : $route"
  }
}
Write-Host "[OK] Pages publiques sans session/sidebar" -ForegroundColor Green

if (
  -not $env:NEXT_PUBLIC_SUPPORT_EMAIL -and
  -not (Select-String -LiteralPath ".env.local" -Pattern '^NEXT_PUBLIC_SUPPORT_EMAIL=' -Quiet -ErrorAction SilentlyContinue)
) {
  Write-Host "[ATTENTION] NEXT_PUBLIC_SUPPORT_EMAIL n'est pas configurée localement." -ForegroundColor Yellow
}
else {
  Write-Host "[OK] Adresse support configurée" -ForegroundColor Green
}

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.18 BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
