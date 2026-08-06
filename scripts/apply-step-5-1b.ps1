$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"
$backup = "$sidebar.step-5-1b.backup"

if (-not (Test-Path -LiteralPath $sidebar)) {
  throw "Fichier introuvable : app\ui\AppSidebar.tsx"
}

Copy-Item `
  -LiteralPath $sidebar `
  -Destination $backup `
  -Force

$content = Get-Content `
  -LiteralPath $sidebar `
  -Raw `
  -Encoding UTF8

if ($content.Contains('href: "/coverage"')) {
  Write-Host ""
  Write-Host "Le lien Couverture locale existe deja." -ForegroundColor Yellow
  Write-Host "Aucun doublon n'a ete ajoute."
  exit 0
}

if (-not $content.Contains("Navigation,")) {
  $importAnchor = @'
  MessageCircle,
  Search,
'@

  $importReplacement = @'
  MessageCircle,
  Navigation,
  Search,
'@

  if ($content.Contains($importAnchor)) {
    $content = $content.Replace(
      $importAnchor,
      $importReplacement
    )
  }
  else {
    throw "Import Lucide Navigation impossible a ajouter."
  }
}

$anchor = @'
  { title: "Trouver un service", href: "/search", icon: Search },
'@

$item = @'
  { title: "Couverture locale", href: "/coverage", icon: Navigation },
'@

if (-not $content.Contains($anchor)) {
  throw "Lien client Trouver un service introuvable."
}

$content = $content.Replace(
  $anchor,
  $anchor + $item
)

Set-Content `
  -LiteralPath $sidebar `
  -Value $content `
  -Encoding UTF8

Write-Host ""
Write-Host "Etape 5.1B appliquee avec succes." -ForegroundColor Green
Write-Host "Le menu prestataire n'a pas ete modifie."
Write-Host "Aucune adresse privee n'est affichee."
Write-Host "Sauvegarde : app\ui\AppSidebar.tsx.step-5-1b.backup"
Write-Host "Execute maintenant : npm run build"
