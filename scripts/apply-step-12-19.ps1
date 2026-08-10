$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.19 - SUPPORT FONCTIONNEL" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "lib\klyx-public-config.ts",
  "app\support\page.tsx"
)

foreach ($relative in $files) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Fichier payload manquant : $relative"
  }
  $parent = Split-Path -Parent $target
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  Write-Host "[OK] $relative" -ForegroundColor Green
}

$envPath = ".env.local"
if (-not (Test-Path -LiteralPath $envPath)) {
  New-Item -ItemType File -Path $envPath -Force | Out-Null
}
$envContent = Get-Content -LiteralPath $envPath -Raw -ErrorAction SilentlyContinue
if ($null -eq $envContent) { $envContent = "" }

if ($envContent -match '(?m)^NEXT_PUBLIC_SUPPORT_EMAIL=') {
  $envContent = [regex]::Replace(
    $envContent,
    '(?m)^NEXT_PUBLIC_SUPPORT_EMAIL=.*$',
    'NEXT_PUBLIC_SUPPORT_EMAIL=klyx237@gmail.com'
  )
} else {
  if ($envContent.Length -gt 0 -and -not $envContent.EndsWith("`n")) {
    $envContent += "`r`n"
  }
  $envContent += "NEXT_PUBLIC_SUPPORT_EMAIL=klyx237@gmail.com`r`n"
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $envPath),
  $envContent,
  [Text.UTF8Encoding]::new($false)
)
Write-Host "[OK] NEXT_PUBLIC_SUPPORT_EMAIL local" -ForegroundColor Green

Write-Host ""
Write-Host "12.19 appliquee." -ForegroundColor Cyan
