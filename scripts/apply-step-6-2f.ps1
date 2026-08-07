$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$layout = Join-Path $root "app\layout.tsx"

if (-not (Test-Path -LiteralPath $layout)) {
  throw "Fichier introuvable : app\layout.tsx"
}

$backup = "$layout.step-6-2f.backup"

if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item `
    -LiteralPath $layout `
    -Destination $backup `
    -Force
}

$content = Get-Content `
  -LiteralPath $layout `
  -Raw `
  -Encoding UTF8

$importLine = 'import ActiveProfileSync from "@/app/components/ActiveProfileSync";'
$importAnchor = 'import PwaRegistrar from "@/app/components/PwaRegistrar";'

if (-not $content.Contains($importLine)) {
  if (-not $content.Contains($importAnchor)) {
    throw "Import PwaRegistrar introuvable dans app\layout.tsx"
  }

  $content = $content.Replace(
    $importAnchor,
    $importAnchor + "`r`n" + $importLine
  )
}

$componentLine = '        <ActiveProfileSync />'
$componentAnchor = '        <PwaRegistrar />'

if (-not $content.Contains($componentLine.Trim())) {
  if (-not $content.Contains($componentAnchor)) {
    throw "Composant PwaRegistrar introuvable dans app\layout.tsx"
  }

  $content = $content.Replace(
    $componentAnchor,
    $componentAnchor + "`r`n" + $componentLine
  )
}

Set-Content `
  -LiteralPath $layout `
  -Value $content `
  -Encoding UTF8

Write-Host ""
Write-Host "Etape 6.2F appliquee avec succes." -ForegroundColor Green
Write-Host "ActiveProfileSync ajoute au layout."
Write-Host "Aucun SQL, Stripe ou schema Supabase modifie."
Write-Host "Execute maintenant : npm run build"
