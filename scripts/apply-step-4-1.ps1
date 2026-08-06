$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"

if (-not (Test-Path -LiteralPath $sidebar)) {
  throw "Fichier introuvable : app\ui\AppSidebar.tsx"
}

Copy-Item -LiteralPath $sidebar -Destination "$sidebar.step-4-1.backup" -Force

$content = Get-Content -LiteralPath $sidebar -Raw

if ($content.Contains('href: "/memory"')) {
  Write-Host "Le lien Mémoire existe déjà. Aucun doublon ajouté." -ForegroundColor Yellow
  exit 0
}

if (-not $content.Contains("Brain,")) {
  $content = $content.Replace(
    "  BriefcaseBusiness,`r`n  CalendarClock,",
    "  Brain,`r`n  BriefcaseBusiness,`r`n  CalendarClock,"
  )
  $content = $content.Replace(
    "  BriefcaseBusiness,`n  CalendarClock,",
    "  Brain,`n  BriefcaseBusiness,`n  CalendarClock,"
  )
}

$anchor = '  { title: "Assistant KLYX", href: "/brain", icon: Sparkles },'
$item = '  { title: "Ma mémoire KLYX", href: "/memory", icon: Brain },'

if (-not $content.Contains($anchor)) {
  throw "Lien Assistant KLYX client introuvable."
}

$content = $content.Replace(
  $anchor,
  $anchor + "`r`n" + $item
)

Set-Content -LiteralPath $sidebar -Value $content -Encoding utf8

Write-Host ""
Write-Host "Étape 4.1 appliquée avec succès." -ForegroundColor Green
Write-Host "Le menu prestataire n’a pas été modifié."
Write-Host "Sauvegarde : app\ui\AppSidebar.tsx.step-4-1.backup"
Write-Host "Exécute maintenant : npm run build"
