$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.39 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$path = "app\login\page.tsx"

if (-not (Test-Path -LiteralPath $path)) {
  throw "Fichier manquant : $path"
}

$content = Get-Content -LiteralPath $path -Raw

if ($content -notmatch 'className="dark\s') {
  throw "Isolation visuelle sombre absente du login."
}
Write-Host "[OK] Login independant du mode clair global" -ForegroundColor Green

if ($content -notmatch 'Connexion à KLYX|Connexion a KLYX|Connexion') {
  throw "Contenu connexion KLYX introuvable."
}
Write-Host "[OK] Formulaire de connexion conserve" -ForegroundColor Green

if ($content -notmatch 'Mot de passe') {
  throw "Champ mot de passe introuvable."
}
Write-Host "[OK] Champs connexion conserves" -ForegroundColor Green

if ($content -notmatch 'Créer un compte|Creer un compte|signup') {
  throw "Lien inscription introuvable."
}
Write-Host "[OK] Inscription conservee" -ForegroundColor Green

Write-Host ""
Write-Host "Verification TypeScript/build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.39 BUILD VALIDE." -ForegroundColor Green
