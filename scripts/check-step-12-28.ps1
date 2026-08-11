$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.28 - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "lib\market-matching.ts",
  "app\provider\jobs\page.tsx",
  "app\api\market\requests\route.ts"
)

foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
  Write-Host "[OK] $file" -ForegroundColor Green
}

$engine = Get-Content -LiteralPath "lib\market-matching.ts" -Raw
$page = Get-Content -LiteralPath "app\provider\jobs\page.tsx" -Raw
$api = Get-Content -LiteralPath "app\api\market\requests\route.ts" -Raw

if ($engine -notmatch "calculateMarketMatch") {
  throw "Moteur matching absent."
}
Write-Host "[OK] Moteur matching" -ForegroundColor Green

if ($engine -notmatch "locationMatch" -or
    $engine -notmatch "availabilityMatch" -or
    $engine -notmatch "budgetMatch") {
  throw "Criteres matching incomplets."
}
Write-Host "[OK] Zone + disponibilite + budget" -ForegroundColor Green

if ($engine -notmatch "klyxScore" -or
    $engine -notmatch "rating" -or
    $engine -notmatch "yearsExperience" -or
    $engine -notmatch "isVerified") {
  throw "Reputation matching incomplete."
}
Write-Host "[OK] Reputation + experience + verification" -ForegroundColor Green

if ($api -notmatch "second\.match\?\.score") {
  throw "Tri par score absent."
}
Write-Host "[OK] Missions triees par score" -ForegroundColor Green

if ($page -notmatch "match\.score" -or
    $page -notmatch "match\.reasons") {
  throw "Explication du matching absente."
}
Write-Host "[OK] Score + raisons visibles" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "KLYX 12.28 BUILD VALIDE." -ForegroundColor Green
