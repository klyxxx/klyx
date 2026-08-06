$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"

if (-not (Test-Path -LiteralPath $sidebar)) {
  throw "Fichier introuvable : app\ui\AppSidebar.tsx"
}

Copy-Item `
  -LiteralPath $sidebar `
  -Destination "$sidebar.step-4-7.backup" `
  -Force

$content = Get-Content -LiteralPath $sidebar -Raw

if ($content.Contains('href: "/request/photo"')) {
  Write-Host "Le lien Recherche par photo existe déjà. Aucun doublon ajouté." -ForegroundColor Yellow
  exit 0
}

if (-not $content.Contains("Camera,")) {
  $content = $content.Replace(
    "  CalendarDays,`r`n  Heart,",
    "  CalendarDays,`r`n  Camera,`r`n  Heart,"
  )
  $content = $content.Replace(
    "  CalendarDays,`n  Heart,",
    "  CalendarDays,`n  Camera,`n  Heart,"
  )
}

$anchor = '  { title: "Trouver un service", href: "/search", icon: Search },'
$item = '  { title: "Recherche par photo", href: "/request/photo", icon: Camera },'

if (-not $content.Contains($anchor)) {
  throw "Lien client Trouver un service introuvable."
}

$content = $content.Replace(
  $anchor,
  $anchor + "`r`n" + $item
)

Set-Content `
  -LiteralPath $sidebar `
  -Value $content `
  -Encoding utf8

Write-Host ""
Write-Host "Étape 4.7 appliquée avec succès." -ForegroundColor Green
Write-Host "Le menu prestataire n’a pas été modifié."
Write-Host "Le bucket photo reste privé."
Write-Host "Sauvegarde : app\ui\AppSidebar.tsx.step-4-7.backup"
Write-Host "Exécute maintenant : npm run build"
