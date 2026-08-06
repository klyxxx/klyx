$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"

if (-not (Test-Path -LiteralPath $sidebar)) {
  throw "Fichier introuvable : app\ui\AppSidebar.tsx"
}

Copy-Item -LiteralPath $sidebar -Destination "$sidebar.step-3-3.backup" -Force

$content = Get-Content -LiteralPath $sidebar -Raw

if ($content.Contains('href: "/provider/verification"')) {
  Write-Host "Le lien Vérification existe déjà. Aucun doublon ajouté." -ForegroundColor Yellow
  exit 0
}

if (-not $content.Contains("BadgeCheck,")) {
  $content = $content.Replace(
    "  Banknote,`r`n  Bell,",
    "  BadgeCheck,`r`n  Banknote,`r`n  Bell,"
  )
  $content = $content.Replace(
    "  Banknote,`n  Bell,",
    "  BadgeCheck,`n  Banknote,`n  Bell,"
  )
}

$anchor = '  { title: "Paiements", href: "/provider/payments", icon: Banknote },'
$item = '  { title: "Vérification", href: "/provider/verification", icon: BadgeCheck },'

if (-not $content.Contains($anchor)) {
  throw "Lien Paiements prestataire introuvable."
}

$content = $content.Replace(
  $anchor,
  $anchor + "`r`n" + $item
)

Set-Content -LiteralPath $sidebar -Value $content -Encoding utf8

Write-Host ""
Write-Host "Étape 3.3 appliquée avec succès." -ForegroundColor Green
Write-Host "Le menu client n’a pas été modifié."
Write-Host "Sauvegarde : app\ui\AppSidebar.tsx.step-3-3.backup"
Write-Host "Exécute maintenant : npm run build"
