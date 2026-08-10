$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$packageRoot = Split-Path -Parent $PSScriptRoot
$payload = Join-Path $packageRoot "payload"

Set-Location $root

Write-Host ""
Write-Host "KLYX 12.11 - AVIS GENERIQUES ET VERIFIES" -ForegroundColor Cyan
Write-Host ""

$files = @(
  @{
    Source = "app\api\reviews\route.ts"
    Target = "app\api\reviews\route.ts"
  },
  @{
    Source = "app\reviews\[bookingId]\page.tsx"
    Target = "app\reviews\[bookingId]\page.tsx"
  }
)

foreach ($item in $files) {
  $source = Join-Path $payload $item.Source
  $target = Join-Path $root $item.Target
  $directory = Split-Path -Parent $target

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Fichier source manquant : $source"
  }

  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force

  Write-Host "[OK] $($item.Target)" -ForegroundColor Green
}

Write-Host ""
Write-Host "12.11 appliquee." -ForegroundColor Cyan
Write-Host "Aucune migration SQL necessaire." -ForegroundColor Cyan
