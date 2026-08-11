$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.40 - AUTH THEME CONSISTENCY" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "app\login\page.tsx",
  "app\signup\page.tsx",
  "app\reset-password\page.tsx"
)

function Add-DarkRootClass {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Fichier manquant : $Path"
  }

  $content = Get-Content -LiteralPath $Path -Raw

  if ($content -match 'className="dark\s') {
    Write-Host "[OK] $Path deja stabilise" -ForegroundColor Green
    return
  }

  $patterns = @(
    '(<main\s+className=")([^"]*min-h[^"]*)',
    '(<div\s+className=")([^"]*min-h[^"]*)',
    '(<section\s+className=")([^"]*min-h[^"]*)'
  )

  $changed = $false

  foreach ($pattern in $patterns) {
    if ($content -match $pattern) {
      $content = [regex]::Replace(
        $content,
        $pattern,
        {
          param($match)

          $classes = $match.Groups[2].Value

          if ($classes -match '(^|\s)dark(\s|$)') {
            return $match.Value
          }

          return $match.Groups[1].Value + 'dark ' + $classes
        },
        1
      )

      $changed = $true
      break
    }
  }

  if (-not $changed) {
    throw "Conteneur racine visuel introuvable : $Path"
  }

  $content = $content.Replace('className="dark dark ', 'className="dark ')

  [IO.File]::WriteAllText(
    (Resolve-Path -LiteralPath $Path),
    $content,
    [Text.UTF8Encoding]::new($false)
  )

  Write-Host "[OK] $Path" -ForegroundColor Green
}

foreach ($file in $files) {
  Add-DarkRootClass -Path $file
}

Write-Host ""
Write-Host "[OK] Connexion lisible en mode clair" -ForegroundColor Green
Write-Host "[OK] Inscription lisible en mode clair" -ForegroundColor Green
Write-Host "[OK] Reinitialisation lisible en mode clair" -ForegroundColor Green
Write-Host "[OK] Theme global KLYX non modifie" -ForegroundColor Green
Write-Host ""
Write-Host "12.40 appliquee. Aucune migration SQL." -ForegroundColor Cyan
