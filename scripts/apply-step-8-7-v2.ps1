$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$targets = @(
  @{
    Path = "app\api\stripe\create-checkout-session\route.ts"
    Method = "POST"
  },
  @{
    Path = "app\api\stripe\connect\create-account\route.ts"
    Method = "POST"
  },
  @{
    Path = "app\api\stripe\connect\status\route.ts"
    Method = "GET"
  },
  @{
    Path = "app\api\stripe\webhook\route.ts"
    Method = "POST"
  }
)

$runtimeImport =
  'import { assertStripeRuntimeReady } from "@/lib/stripe-runtime";'

foreach ($target in $targets) {
  $relative = $target.Path
  $method = $target.Method
  $file = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $relative"
  }

  $backup = "$file.step-8-7.backup"

  if (-not (Test-Path -LiteralPath $backup)) {
    Copy-Item `
      -LiteralPath $file `
      -Destination $backup `
      -Force
  }

  $content = Get-Content `
    -LiteralPath $file `
    -Raw `
    -Encoding UTF8

  # ----------------------------------------------------------
  # Import central Stripe runtime
  # ----------------------------------------------------------

  if (-not $content.Contains($runtimeImport)) {
    $nextImportPattern =
      'import\s*\{\s*NextResponse\s*\}\s*from\s*"next/server";'

    $match =
      [regex]::Match(
        $content,
        $nextImportPattern
      )

    if (-not $match.Success) {
      throw "Import NextResponse introuvable : $relative"
    }

    $replacement =
      $match.Value +
      "`r`n" +
      $runtimeImport

    $content =
      $content.Remove(
        $match.Index,
        $match.Length
      ).Insert(
        $match.Index,
        $replacement
      )
  }

  # ----------------------------------------------------------
  # Injecte le verrou juste apres l'ouverture de GET/POST.
  # Ne depend pas du formatage du fichier.
  # ----------------------------------------------------------

  if (-not $content.Contains("assertStripeRuntimeReady();")) {
    $functionPattern =
      'export\s+async\s+function\s+' +
      $method +
      '\s*\(\s*request\s*:\s*Request\s*\)\s*\{'

    $functionMatch =
      [regex]::Match(
        $content,
        $functionPattern
      )

    if (-not $functionMatch.Success) {
      throw "Fonction $method introuvable : $relative"
    }

    $replacement =
      $functionMatch.Value +
      "`r`n  assertStripeRuntimeReady();"

    $content =
      $content.Remove(
        $functionMatch.Index,
        $functionMatch.Length
      ).Insert(
        $functionMatch.Index,
        $replacement
      )
  }

  Set-Content `
    -LiteralPath $file `
    -Value $content `
    -Encoding UTF8

  Write-Host "[OK] $relative" -ForegroundColor Green
}

Write-Host ""
Write-Host "ETAPE 8.7 V2 APPLIQUEE." -ForegroundColor Green
Write-Host "Verrou Stripe test/live actif sur les 4 routes."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
