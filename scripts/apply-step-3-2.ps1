$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"

if (-not (Test-Path -LiteralPath $sidebar)) {
  throw "Fichier introuvable : app\ui\AppSidebar.tsx"
}

Copy-Item -LiteralPath $sidebar -Destination "$sidebar.step-3-2.backup" -Force

$content = Get-Content -LiteralPath $sidebar -Raw

if ($content.Contains('href: "/security"')) {
  Write-Host "Le lien Sécurité existe déjà. Aucun doublon ajouté." -ForegroundColor Yellow
  exit 0
}

if (-not $content.Contains("Gauge,")) {
  $content = $content.Replace(
    "  Heart,`r`n  LayoutDashboard,",
    "  Gauge,`r`n  Heart,`r`n  LayoutDashboard,"
  )
  $content = $content.Replace(
    "  Heart,`n  LayoutDashboard,",
    "  Gauge,`n  Heart,`n  LayoutDashboard,"
  )
}

$clientAnchor = '  { title: "Centre de confiance", href: "/trust", icon: ShieldCheck },'
$providerAnchor = @'
  {
    title: "Confiance professionnelle",
    href: "/provider/trust",
    icon: ShieldCheck,
  },
'@

$securityItem = @'
  { title: "Sécurité du profil", href: "/security", icon: Gauge },
'@

if (-not $content.Contains($clientAnchor)) {
  throw "Lien client Centre de confiance introuvable."
}

$content = $content.Replace(
  $clientAnchor,
  $clientAnchor + "`r`n" + $securityItem.TrimEnd()
)

if ($content.Contains($providerAnchor)) {
  $content = $content.Replace(
    $providerAnchor,
    $providerAnchor + $securityItem
  )
} else {
  throw "Lien prestataire Confiance professionnelle introuvable."
}

Set-Content -LiteralPath $sidebar -Value $content -Encoding utf8

Write-Host ""
Write-Host "Étape 3.2 appliquée avec succès." -ForegroundColor Green
Write-Host "Sauvegarde créée : app\ui\AppSidebar.tsx.step-3-2.backup"
Write-Host "Exécute maintenant : npm run build"
