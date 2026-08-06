$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$layout = Join-Path $root "app\layout.tsx"

if (-not (Test-Path -LiteralPath $layout)) {
  throw "Fichier introuvable : app\layout.tsx"
}

Copy-Item `
  -LiteralPath $layout `
  -Destination "$layout.visual-system.backup" `
  -Force

$content = Get-Content -LiteralPath $layout -Raw

$visualImport = 'import AppVisualBackground from "@/app/ui/AppVisualBackground";'
$cssImport = 'import "./klyx-visual-system.css";'

if (-not $content.Contains($visualImport)) {
  $anchor = 'import PwaRegistrar from "@/app/components/PwaRegistrar";'

  if (-not $content.Contains($anchor)) {
    throw "Import PwaRegistrar introuvable."
  }

  $content = $content.Replace(
    $anchor,
    $anchor + "`r`n" + $visualImport
  )
}

if (-not $content.Contains($cssImport)) {
  $anchor = 'import "./globals.css";'

  if (-not $content.Contains($anchor)) {
    throw "Import globals.css introuvable."
  }

  $content = $content.Replace(
    $anchor,
    $anchor + "`r`n" + $cssImport
  )
}

if (-not $content.Contains("<AppVisualBackground />")) {
  $anchor = @'
      <body className="min-h-full bg-background text-foreground">
        <PwaRegistrar />
'@

  $replacement = @'
      <body className="min-h-full bg-background text-foreground">
        <PwaRegistrar />
        <AppVisualBackground />
'@

  if (-not $content.Contains($anchor)) {
    throw "Début du body introuvable."
  }

  $content = $content.Replace(
    $anchor,
    $replacement
  )
}

$content = $content.Replace(
  '<div className="min-h-screen lg:flex">',
  '<div className="klyx-app-shell min-h-screen lg:flex">'
)

$content = $content.Replace(
  '<div className="min-w-0 flex-1">{children}</div>',
  '<div className="klyx-app-content min-w-0 flex-1">{children}</div>'
)

Set-Content `
  -LiteralPath $layout `
  -Value $content `
  -Encoding utf8

Write-Host ""
Write-Host "Identité visuelle globale appliquée." -ForegroundColor Green
Write-Host "Toutes les pages partagent maintenant l’effet visuel premium."
Write-Host "Les fonctions Client et Prestataire restent séparées."
Write-Host "Sauvegarde : app\layout.tsx.visual-system.backup"
Write-Host "Exécute maintenant : npm run build"
