$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"

if (-not (Test-Path -LiteralPath $sidebar)) {
  throw "Fichier introuvable : app\ui\AppSidebar.tsx"
}

Copy-Item -LiteralPath $sidebar -Destination "$sidebar.step-3-1.backup" -Force

$content = Get-Content -LiteralPath $sidebar -Raw

if (-not $content.Contains("ShieldCheck,")) {
  $content = $content.Replace(
    "  Search,`r`n  Settings,",
    "  Search,`r`n  Settings,`r`n  ShieldCheck,"
  )
  $content = $content.Replace(
    "  Search,`n  Settings,",
    "  Search,`n  Settings,`n  ShieldCheck,"
  )
}

$clientAnchor = @'
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
'@

$trustItem = @'
  {
    title: "Centre de confiance",
    href: "/trust",
    icon: ShieldCheck,
  },
'@

if (-not $content.Contains('href: "/trust"')) {
  if (-not $content.Contains($clientAnchor)) {
    throw "Point d’insertion du menu introuvable."
  }

  $content = $content.Replace(
    $clientAnchor,
    $clientAnchor + $trustItem
  )

  $providerAnchor = @'
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
'@

  $first = $content.IndexOf($providerAnchor)
  $second = $content.IndexOf(
    $providerAnchor,
    $first + $providerAnchor.Length
  )

  if ($second -ge 0) {
    $content = $content.Insert(
      $second + $providerAnchor.Length,
      $trustItem
    )
  }
}

Set-Content -LiteralPath $sidebar -Value $content -Encoding utf8

Write-Host ""
Write-Host "Étape 3.1 appliquée avec succès." -ForegroundColor Green
Write-Host "Sauvegarde créée : app\ui\AppSidebar.tsx.step-3-1.backup"
Write-Host "Exécute maintenant : npm run build"
