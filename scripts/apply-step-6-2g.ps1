$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dashboard = Join-Path $root "app\dashboard\page.tsx"
$prefetch = Join-Path $root "app\components\KlyxRoutePrefetch.tsx"

foreach ($file in @($dashboard, $prefetch)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
  }
}

$backup = "$dashboard.step-6-2g.backup"
if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $dashboard -Destination $backup -Force
}

$content = Get-Content -LiteralPath $dashboard -Raw -Encoding UTF8
$importLine = 'import KlyxRoutePrefetch from "@/app/components/KlyxRoutePrefetch";'
$anchor = 'import AccountSwitcher from "@/app/components/AccountSwitcher";'

if (-not $content.Contains($importLine)) {
  if (-not $content.Contains($anchor)) {
    throw "Import AccountSwitcher introuvable dans dashboard."
  }
  $content = $content.Replace($anchor, $anchor + "`r`n" + $importLine)
}

$marker = '<KlyxRoutePrefetch accountType={profile.accountType} />'
if (-not $content.Contains($marker)) {
  $mainAnchor = '    <main className="klyx-page">'
  if (-not $content.Contains($mainAnchor)) {
    throw "Balise main du dashboard introuvable."
  }
  $content = $content.Replace($mainAnchor, $mainAnchor + "`r`n      " + $marker)
}

Set-Content -LiteralPath $dashboard -Value $content -Encoding UTF8

Write-Host ""
Write-Host "Etape 6.2G appliquee avec succes." -ForegroundColor Green
Write-Host "Prefetch intelligent Client/Prestataire active."
Write-Host "Les espaces Client et Prestataire restent separes."
Write-Host "Aucun SQL, Stripe, Supabase schema ou account-switcher modifie."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
