$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.42B - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$path = "app\assistant\market\page.tsx"

if (-not (Test-Path -LiteralPath $path)) {
  throw "Fichier manquant : $path"
}

$content = Get-Content -LiteralPath $path -Raw

if ($content -match "useSearchParams") {
  throw "Ancien useSearchParams encore present."
}
Write-Host "[OK] useSearchParams supprime" -ForegroundColor Green

if ($content -notmatch "window\.location\.search") {
  throw "Lecture URL navigateur absente."
}
Write-Host "[OK] URL lue sans CSR bailout" -ForegroundColor Green

if ($content -notmatch 'searchParams\.get\("request"\)') {
  throw "Parametre request absent."
}
Write-Host "[OK] Parametre request recupere" -ForegroundColor Green

if ($content -notmatch "setInput") {
  throw "Pre-remplissage absent."
}
Write-Host "[OK] Demande pre-remplie" -ForegroundColor Green

if ($content -notmatch "current\.trim\(\)\s*\?\s*current\s*:\s*initialRequest") {
  throw "Protection saisie existante absente."
}
Write-Host "[OK] Saisie existante non ecrasee" -ForegroundColor Green

Write-Host ""
Write-Host "Verification TypeScript/build..." -ForegroundColor Cyan

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.42B BUILD VALIDE." -ForegroundColor Green
