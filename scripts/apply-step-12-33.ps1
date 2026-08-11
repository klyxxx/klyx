$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.33 - AI MARKET COPILOT" -ForegroundColor Cyan
Write-Host ""

foreach ($relative in @(
  "app\api\brain\market-status\[id]\route.ts",
  "app\assistant\market\[id]\MarketStatusTracker.tsx"
)) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Payload manquant : $relative"
  }

  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force

  Write-Host "[OK] $relative" -ForegroundColor Green
}

$pagePath = "app\assistant\market\[id]\page.tsx"
$page = Get-Content -LiteralPath $pagePath -Raw

$import = 'import MarketStatusTracker from "./MarketStatusTracker";'
$anchor = 'import { supabase } from "@/lib/supabase";'

if (-not $page.Contains($import)) {
  if (-not $page.Contains($anchor)) {
    throw "Ancre import page conseiller introuvable."
  }

  $page = $page.Replace(
    $anchor,
    "$anchor`r`n$import"
  )
}

$tracker = @'
        <MarketStatusTracker requestId={params.id} />

'@

if ($page -notmatch 'MarketStatusTracker requestId') {
  $sectionAnchor = '        <section className="klyx-card mt-6 border-violet-500/20 p-6 sm:p-8">'

  if (-not $page.Contains($sectionAnchor)) {
    throw "Ancre section analyse KLYX introuvable."
  }

  $page = $page.Replace(
    $sectionAnchor,
    $tracker + $sectionAnchor
  )
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $pagePath),
  $page,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Copilote integre au conseiller" -ForegroundColor Green
Write-Host "[OK] Suivi automatique toutes les 30 secondes" -ForegroundColor Green
Write-Host "[OK] Prochaine action calculee cote serveur" -ForegroundColor Green
Write-Host ""
Write-Host "12.33 appliquee. Aucune migration SQL." -ForegroundColor Cyan
