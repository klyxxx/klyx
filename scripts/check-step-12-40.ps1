$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.40 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "app\login\page.tsx",
  "app\signup\page.tsx",
  "app\reset-password\page.tsx"
)

foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }

  $content = Get-Content -LiteralPath $file -Raw

  if ($content -notmatch 'className="dark\s') {
    throw "Theme auth sombre stable absent : $file"
  }

  Write-Host "[OK] $file" -ForegroundColor Green
}

$layout = Get-Content -LiteralPath "app\layout.tsx" -Raw

if ($layout -match '<html[^>]+className="dark') {
  throw "Le mode sombre ne doit pas etre force globalement."
}

Write-Host "[OK] Theme global non force" -ForegroundColor Green
Write-Host "[OK] Pages auth independantes du mode clair" -ForegroundColor Green

Write-Host ""
Write-Host "Verification TypeScript/build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.40 BUILD VALIDE." -ForegroundColor Green
