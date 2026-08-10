$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.10B - VERIFICATION" -ForegroundColor Cyan
Write-Host ""

$globalsPath = "app\globals.css"

if (-not (Test-Path -LiteralPath $globalsPath)) {
  throw "app\globals.css introuvable."
}

$globals = Get-Content -LiteralPath $globalsPath -Raw

$checks = @(
  @{ Label = "Marqueur 12.10B"; Pattern = "KLYX 12\.10B - LIGHT PROFILES \+ MOBILE FIELDS" },
  @{ Label = "Profils clairs"; Pattern = 'article\[class\*="rounded"\]' },
  @{ Label = "Date Safari"; Pattern = 'input\[type="date"\]::-webkit-date-and-time-value' },
  @{ Label = "Time Safari"; Pattern = 'input\[type="time"\]::-webkit-date-and-time-value' },
  @{ Label = "Appearance native neutralisee"; Pattern = '-webkit-appearance:\s*none' },
  @{ Label = "Hamburger clair"; Pattern = 'button\[aria-label="Ouvrir le menu"\]' }
)

foreach ($check in $checks) {
  if ($globals -notmatch $check.Pattern) {
    throw "[ECHEC] $($check.Label)"
  }
  Write-Host "[OK] $($check.Label)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Audit rapide des anciens gris/sombres..." -ForegroundColor Cyan

$legacy = Get-ChildItem .\app -Recurse -File -Include *.tsx,*.ts |
  Select-String -Pattern 'bg-zinc-950|bg-zinc-900|bg-zinc-800|text-zinc-200|text-zinc-300|text-zinc-400|text-zinc-500' |
  Select-Object -First 12

if ($legacy) {
  Write-Host "[INFO] Des classes legacy existent encore dans le code, mais 12.10B les neutralise en mode clair." -ForegroundColor Yellow
} else {
  Write-Host "[OK] Aucun legacy evident." -ForegroundColor Green
}

Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX 12.10B BUILD VALIDE." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
