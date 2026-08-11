$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.37 - PROACTIVE ASSISTANT" -ForegroundColor Cyan
Write-Host ""

$source = Join-Path $payload "app\components\ProactiveAssistantPanel.tsx"
$target = Join-Path $root "app\components\ProactiveAssistantPanel.tsx"

if (-not (Test-Path -LiteralPath $source)) {
  throw "Payload ProactiveAssistantPanel manquant."
}

New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host "[OK] app\components\ProactiveAssistantPanel.tsx" -ForegroundColor Green

$pagePath = "app\assistant\page.tsx"
$page = Get-Content -LiteralPath $pagePath -Raw

$importAnchor = 'import { supabase } from "@/lib/supabase";'
$panelImport = 'import ProactiveAssistantPanel from "@/app/components/ProactiveAssistantPanel";'

if (-not $page.Contains($panelImport)) {
  if (-not $page.Contains($importAnchor)) {
    throw "Ancre import assistant page introuvable."
  }

  $page = $page.Replace(
    $importAnchor,
    "$importAnchor`r`n$panelImport"
  )
}

if ($page -notmatch '<ProactiveAssistantPanel') {
  $anchor = '        {errorMessage && ('

  if (-not $page.Contains($anchor)) {
    throw "Ancre errorMessage assistant page introuvable."
  }

  $page = $page.Replace(
    $anchor,
    "        <ProactiveAssistantPanel />`r`n`r`n$anchor"
  )
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $pagePath),
  $page,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Assistant proactif integre dans /assistant" -ForegroundColor Green
Write-Host "[OK] Explication Pourquoi maintenant" -ForegroundColor Green
Write-Host "[OK] Garde-fous confirmation affiches" -ForegroundColor Green
Write-Host "[OK] Refresh automatique 30 secondes" -ForegroundColor Green
Write-Host ""
Write-Host "12.37 appliquee. Aucune migration SQL." -ForegroundColor Cyan
