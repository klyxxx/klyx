$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"

if (-not (Test-Path -LiteralPath $sidebar)) {
  throw "Fichier introuvable : app\ui\AppSidebar.tsx"
}

Copy-Item `
  -LiteralPath $sidebar `
  -Destination "$sidebar.step-4-8.backup" `
  -Force

$content = Get-Content -LiteralPath $sidebar -Raw

if ($content.Contains('href: "/agent"')) {
  Write-Host "Le lien KLYX Agent existe déjà. Aucun doublon ajouté." -ForegroundColor Yellow
  exit 0
}

if (-not $content.Contains("Bot,")) {
  $content = $content.Replace(
    "  Banknote,`r`n  Bell,",
    "  Banknote,`r`n  Bell,`r`n  Bot,"
  )
  $content = $content.Replace(
    "  Banknote,`n  Bell,",
    "  Banknote,`n  Bell,`n  Bot,"
  )
}

$anchor = '  { title: "Assistant KLYX", href: "/brain", icon: Sparkles },'
$item = '  { title: "KLYX Agent", href: "/agent", icon: Bot },'

if (-not $content.Contains($anchor)) {
  throw "Lien Assistant KLYX client introuvable."
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
Write-Host "Étape 4.8 appliquée avec succès." -ForegroundColor Green
Write-Host "Le menu prestataire n’a pas été modifié."
Write-Host "Aucune réservation et aucun paiement automatiques."
Write-Host "Sauvegarde : app\ui\AppSidebar.tsx.step-4-8.backup"
Write-Host "Exécute maintenant : npm run build"
