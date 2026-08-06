$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"

if (-not (Test-Path -LiteralPath $sidebar)) {
  throw "Fichier introuvable : app\ui\AppSidebar.tsx"
}

Copy-Item -LiteralPath $sidebar -Destination "$sidebar.step-4-5.backup" -Force

$content = Get-Content -LiteralPath $sidebar -Raw

if ($content.Contains('href: "/provider/planning"')) {
  Write-Host "Le lien Planning intelligent existe déjà. Aucun doublon ajouté." -ForegroundColor Yellow
  exit 0
}

$anchor = '  { title: "Missions", href: "/bookings", icon: CalendarClock },'
$item = '  { title: "Planning intelligent", href: "/provider/planning", icon: CalendarClock },'

if (-not $content.Contains($anchor)) {
  throw "Lien Missions prestataire introuvable."
}

$content = $content.Replace(
  $anchor,
  $anchor + "`r`n" + $item
)

Set-Content -LiteralPath $sidebar -Value $content -Encoding utf8

Write-Host ""
Write-Host "Étape 4.5 appliquée avec succès." -ForegroundColor Green
Write-Host "Le menu client n’a pas été modifié."
Write-Host "Aucune réservation n’a été modifiée."
Write-Host "Sauvegarde : app\ui\AppSidebar.tsx.step-4-5.backup"
Write-Host "Exécute maintenant : npm run build"
