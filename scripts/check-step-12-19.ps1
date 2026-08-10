$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.19 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$config = Get-Content -LiteralPath "lib\klyx-public-config.ts" -Raw
$support = Get-Content -LiteralPath "app\support\page.tsx" -Raw
$envContent = Get-Content -LiteralPath ".env.local" -Raw

if ($config -notmatch 'klyx237@gmail\.com') {
  throw "Adresse support KLYX absente du fallback."
}
Write-Host "[OK] Adresse support KLYX" -ForegroundColor Green

if ($envContent -notmatch '(?m)^NEXT_PUBLIC_SUPPORT_EMAIL=klyx237@gmail\.com\s*$') {
  throw "NEXT_PUBLIC_SUPPORT_EMAIL incorrecte dans .env.local."
}
Write-Host "[OK] Variable locale support" -ForegroundColor Green

if ($support -notmatch 'mailto:' -or $support -notmatch 'encodeURIComponent') {
  throw "Liens e-mail fonctionnels absents."
}
Write-Host "[OK] Boutons mailto fonctionnels" -ForegroundColor Green

if ($support -notmatch 'problème de paiement' -or $support -notmatch 'sécurité du compte') {
  throw "Sujets support specialises absents."
}
Write-Host "[OK] Sujets support pre-remplis" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.19 BUILD VALIDE." -ForegroundColor Green
