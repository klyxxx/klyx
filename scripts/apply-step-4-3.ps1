$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"

if (-not (Test-Path -LiteralPath $sidebar)) {
  throw "Fichier introuvable : app\ui\AppSidebar.tsx"
}

Copy-Item -LiteralPath $sidebar -Destination "$sidebar.step-4-3.backup" -Force

$content = Get-Content -LiteralPath $sidebar -Raw

if ($content.Contains('href: "/provider/assistant"')) {
  Write-Host "Le lien Assistant professionnel existe déjà. Aucun doublon ajouté." -ForegroundColor Yellow
  exit 0
}

if (-not $content.Contains("Bot,")) {
  $content = $content.Replace(
    "  BriefcaseBusiness,`r`n  CalendarClock,",
    "  Bot,`r`n  BriefcaseBusiness,`r`n  CalendarClock,"
  )
  $content = $content.Replace(
    "  BriefcaseBusiness,`n  CalendarClock,",
    "  Bot,`n  BriefcaseBusiness,`n  CalendarClock,"
  )
}

$anchor = '  { title: "Mon activité", href: "/provider", icon: BriefcaseBusiness },'
$item = '  { title: "Assistant professionnel", href: "/provider/assistant", icon: Bot },'

if (-not $content.Contains($anchor)) {
  throw "Lien Mon activité introuvable."
}

$content = $content.Replace(
  $anchor,
  $anchor + "`r`n" + $item
)

Set-Content -LiteralPath $sidebar -Value $content -Encoding utf8

Write-Host ""
Write-Host "Étape 4.3 appliquée avec succès." -ForegroundColor Green
Write-Host "Le menu client n’a pas été modifié."
Write-Host "Sauvegarde : app\ui\AppSidebar.tsx.step-4-3.backup"
Write-Host "Exécute maintenant : npm run build"
