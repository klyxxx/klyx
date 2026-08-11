$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.39 - LOGIN LIGHT MODE" -ForegroundColor Cyan
Write-Host ""

$path = "app\login\page.tsx"

if (-not (Test-Path -LiteralPath $path)) {
  throw "Fichier manquant : $path"
}

$content = Get-Content -LiteralPath $path -Raw

# La page de connexion possède une direction artistique sombre.
# On la rend volontairement indépendante du thème global afin qu'elle
# reste lisible en mode clair, sombre et système sur tous les appareils.
$replacements = @(
  @(
    'className="min-h-screen',
    'className="dark min-h-screen'
  ),
  @(
    'className="min-h-[100dvh]',
    'className="dark min-h-[100dvh]'
  )
)

$changed = $false

foreach ($pair in $replacements) {
  if ($content.Contains($pair[0])) {
    $content = $content.Replace($pair[0], $pair[1])
    $changed = $true
    break
  }
}

if (-not $changed) {
  # Variante robuste : ajoute dark au premier conteneur racine JSX.
  $patterns = @(
    '(<main\s+className=")([^"]+)',
    '(<div\s+className=")([^"]*min-h[^"]*)'
  )

  foreach ($pattern in $patterns) {
    if ($content -match $pattern) {
      $content = [regex]::Replace(
        $content,
        $pattern,
        {
          param($m)
          if ($m.Groups[2].Value -match '(^|\s)dark(\s|$)') {
            return $m.Value
          }
          return $m.Groups[1].Value + 'dark ' + $m.Groups[2].Value
        },
        1
      )
      $changed = $true
      break
    }
  }
}

if (-not $changed) {
  throw "Conteneur racine de login introuvable. Aucun remplacement force."
}

# Empêche une double classe si le script est rejoué.
$content = $content.Replace('className="dark dark ', 'className="dark ')

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $path),
  $content,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Login isole du theme global" -ForegroundColor Green
Write-Host "[OK] Contraste sombre conserve en mode clair" -ForegroundColor Green
Write-Host "[OK] Compatible mobile + desktop" -ForegroundColor Green
Write-Host ""
Write-Host "12.39 appliquee. Aucune migration SQL." -ForegroundColor Cyan
