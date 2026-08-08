$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$adminFile = Join-Path $root "app\admin\page.tsx"

if (-not (Test-Path -LiteralPath $adminFile)) {
  throw "Fichier introuvable : app\admin\page.tsx"
}

$backup = "$adminFile.step-11-0.backup"

if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $adminFile -Destination $backup -Force
}

$content = Get-Content -LiteralPath $adminFile -Raw -Encoding UTF8

if (-not $content.Contains("Rocket,")) {
  $content = $content.Replace(
    "  Search,`r`n  ShieldCheck,",
    "  Search,`r`n  Rocket,`r`n  ShieldCheck,"
  )

  if (-not $content.Contains("Rocket,")) {
    $content = $content.Replace(
      "  Search,`n  ShieldCheck,",
      "  Search,`n  Rocket,`n  ShieldCheck,"
    )
  }
}

if (-not $content.Contains('href: "/admin/launch"')) {
  $areasMarker = @'
const AREAS = [
'@

  $launchArea = @'
const AREAS = [
  {
    title: "Centre de lancement",
    description:
      "Contrôler les briques essentielles avant ouverture de KLYX.",
    href: "/admin/launch",
    icon: Rocket,
  },
'@

  if (-not $content.Contains($areasMarker.TrimEnd())) {
    throw "Tableau AREAS introuvable dans app\admin\page.tsx"
  }

  $content = $content.Replace(
    $areasMarker.TrimEnd(),
    $launchArea.TrimEnd()
  )
}

Set-Content -LiteralPath $adminFile -Value $content -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 11.0 APPLIQUEE." -ForegroundColor Green
Write-Host "- /admin/launch ajoute"
Write-Host "- Centre de lancement ajoute au Centre Admin"
Write-Host ""
Write-Host "Execute maintenant : npm run build"
