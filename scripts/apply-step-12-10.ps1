$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$packageRoot = Split-Path -Parent $PSScriptRoot
$payload = Join-Path $packageRoot "payload"

Write-Host ""
Write-Host "KLYX 12.10 - THEME FINAL + MOBILE + FAVICON" -ForegroundColor Cyan
Write-Host ""

$globalsPath = Join-Path $root "app\globals.css"
if (-not (Test-Path -LiteralPath $globalsPath)) {
  throw "app\globals.css introuvable."
}

# Assets
$assetMap = @(
  @{ Source = "public\icon.svg"; Target = "public\icon.svg" },
  @{ Source = "public\icons\icon-192.png"; Target = "public\icons\icon-192.png" },
  @{ Source = "public\icons\icon-512.png"; Target = "public\icons\icon-512.png" },
  @{ Source = "public\icons\apple-touch-icon.png"; Target = "public\icons\apple-touch-icon.png" },
  @{ Source = "app\favicon.ico"; Target = "app\favicon.ico" }
)

foreach ($asset in $assetMap) {
  $src = Join-Path $payload $asset.Source
  $dst = Join-Path $root $asset.Target
  $dir = Split-Path -Parent $dst

  if (-not (Test-Path -LiteralPath $src)) {
    throw "Asset 12.10 manquant : $src"
  }

  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  Copy-Item -LiteralPath $src -Destination $dst -Force
}

Write-Host "[OK] Favicon + PWA icons KLYX remplaces." -ForegroundColor Green

# Theme CSS append, idempotent.
$globals = Get-Content -LiteralPath $globalsPath -Raw
$marker = "/* KLYX 12.10 - THEME FINAL + MOBILE SAFARI */"

if ($globals -notmatch [regex]::Escape($marker)) {
  $patch = Get-Content -LiteralPath (Join-Path $payload "theme-12-10.css.txt") -Raw
  $globals = $globals.TrimEnd() + "`r`n`r`n" + $patch + "`r`n"

  [System.IO.File]::WriteAllText(
    $globalsPath,
    $globals,
    [System.Text.UTF8Encoding]::new($false)
  )

  Write-Host "[OK] Couche theme 12.10 ajoutee." -ForegroundColor Green
}
else {
  Write-Host "[OK] Couche theme 12.10 deja presente." -ForegroundColor Green
}

# KlyxLogo: black in light, white in dark.
$logoPath = Join-Path $root "app\ui\KlyxLogo.tsx"
if (Test-Path -LiteralPath $logoPath) {
  $logo = Get-Content -LiteralPath $logoPath -Raw

  $logo = $logo.Replace(
    'dark ? "text-zinc-950 dark:text-white" : "text-white"',
    'dark ? "text-zinc-950 dark:text-white" : "text-zinc-950 dark:text-white"'
  )

  [System.IO.File]::WriteAllText(
    $logoPath,
    $logo,
    [System.Text.UTF8Encoding]::new($false)
  )

  Write-Host "[OK] Logo noir clair / blanc sombre." -ForegroundColor Green
}

Write-Host ""
Write-Host "12.10 appliquee. Aucune API/Supabase/Stripe modifiee." -ForegroundColor Cyan
