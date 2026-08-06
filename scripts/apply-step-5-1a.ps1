$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"
$backup = "$sidebar.step-5-1a.backup"

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

if ($content.Contains('href: "/provider/zones"')) {
    Write-Host ""
    Write-Host "Le lien Zones d'intervention existe deja." -ForegroundColor Yellow
    Write-Host "Aucun doublon n'a ete ajoute."
    exit 0
}

if (-not $content.Contains("Navigation,")) {
    $windowsImportAnchor = @'
  MessageCircle,
  Search,
'@

    $windowsImportReplacement = @'
  MessageCircle,
  Navigation,
  Search,
'@

    if ($content.Contains($windowsImportAnchor)) {
        $content = $content.Replace(
            $windowsImportAnchor,
            $windowsImportReplacement
        )
    }
    else {
        throw "Import Lucide Navigation impossible a ajouter."
    }
}

$planningAnchor = @'
  { title: "Planning intelligent", href: "/provider/planning", icon: CalendarClock },
'@

$activityAnchor = @'
  { title: "Mon activité", href: "/provider", icon: BriefcaseBusiness },
'@

$item = @'
  { title: "Zones d'intervention", href: "/provider/zones", icon: Navigation },
'@

if ($content.Contains($planningAnchor)) {
    $content = $content.Replace(
        $planningAnchor,
        $planningAnchor + $item
    )
}
elseif ($content.Contains($activityAnchor)) {
    $content = $content.Replace(
        $activityAnchor,
        $activityAnchor + $item
    )
}
else {
    throw "Lien prestataire de reference introuvable."
}

Set-Content `
    -LiteralPath $sidebar `
    -Value $content `
    -Encoding UTF8

Write-Host ""
Write-Host "Etape 5.1A appliquee avec succes." -ForegroundColor Green
Write-Host "Le menu client n'a pas ete modifie."
Write-Host "Aucune position GPS personnelle n'est enregistree."
Write-Host "Sauvegarde : app\ui\AppSidebar.tsx.step-5-1a.backup"
Write-Host "Execute maintenant : npm run build"