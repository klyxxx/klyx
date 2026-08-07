$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"
$backup = "$sidebar.step-6-2.backup"

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

if (-not $content.Contains("FileText,")) {
  $anchor = "  Euro,"

  if (-not $content.Contains($anchor)) {
    $anchor = "  Heart,"
  }

  if (-not $content.Contains($anchor)) {
    throw "Impossible d'ajouter l'import FileText."
  }

  $content = $content.Replace(
    $anchor,
    $anchor + "`r`n  FileText,"
  )
}

if (-not $content.Contains('href: "/quotes"')) {
  $clientAnchors = @(
    '  { title: "Réservations", href: "/bookings", icon: CalendarDays },',
    '  { title: "Favoris", href: "/favorites", icon: Heart },'
  )

  $clientAnchor = $null

  foreach ($candidate in $clientAnchors) {
    if ($content.Contains($candidate)) {
      $clientAnchor = $candidate
      break
    }
  }

  if (-not $clientAnchor) {
    throw "Lien client de référence introuvable."
  }

  $clientItem = '  { title: "Mes devis", href: "/quotes", icon: FileText },'

  $content = $content.Replace(
    $clientAnchor,
    $clientAnchor + "`r`n" + $clientItem
  )
}

if (-not $content.Contains('href: "/provider/quotes"')) {
  $providerAnchors = @(
    '  { title: "Missions", href: "/bookings", icon: CalendarClock },',
    '  { title: "Mon activité", href: "/provider", icon: BriefcaseBusiness },'
  )

  $providerAnchor = $null

  foreach ($candidate in $providerAnchors) {
    if ($content.Contains($candidate)) {
      $providerAnchor = $candidate
      break
    }
  }

  if (-not $providerAnchor) {
    throw "Lien prestataire de référence introuvable."
  }

  $providerItem = '  { title: "Demandes de devis", href: "/provider/quotes", icon: FileText },'

  $content = $content.Replace(
    $providerAnchor,
    $providerAnchor + "`r`n" + $providerItem
  )
}

Set-Content `
  -LiteralPath $sidebar `
  -Value $content `
  -Encoding UTF8

Write-Host ""
Write-Host "Etape 6.2 appliquee avec succes." -ForegroundColor Green
Write-Host "Client et prestataire ont des espaces devis differents."
Write-Host "Aucune reservation et aucun paiement automatiques."
Write-Host "Sauvegarde : app\ui\AppSidebar.tsx.step-6-2.backup"
Write-Host "Execute maintenant : npm run build"
