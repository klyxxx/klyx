$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.38 - ASSISTANT BRIEF" -ForegroundColor Cyan
Write-Host ""

$source = Join-Path $payload "app\components\AssistantBrief.tsx"
$target = Join-Path $root "app\components\AssistantBrief.tsx"

if (-not (Test-Path -LiteralPath $source)) {
  throw "Payload AssistantBrief manquant."
}

New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force

$pagePath = "app\assistant\page.tsx"
$page = Get-Content -LiteralPath $pagePath -Raw

$importAnchor = 'import ProactiveAssistantPanel from "@/app/components/ProactiveAssistantPanel";'
$briefImport = 'import AssistantBrief from "@/app/components/AssistantBrief";'

if (-not $page.Contains($briefImport)) {
  if (-not $page.Contains($importAnchor)) {
    throw "Import ProactiveAssistantPanel introuvable."
  }

  $page = $page.Replace(
    $importAnchor,
    "$importAnchor`r`n$briefImport"
  )
}

if ($page -notmatch '<AssistantBrief') {
  $heroText = '            KLYX rassemble tes prochaines actions,'
  $heroEnd = '          </p>'

  $start = $page.IndexOf($heroText)
  if ($start -lt 0) {
    throw "Texte hero assistant introuvable."
  }

  $end = $page.IndexOf($heroEnd, $start)
  if ($end -lt 0) {
    throw "Fin hero assistant introuvable."
  }

  $end = $end + $heroEnd.Length

  $page = $page.Insert(
    $end,
    "`r`n`r`n          <AssistantBrief />"
  )
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $pagePath),
  $page,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] AssistantBrief installe" -ForegroundColor Green
Write-Host "[OK] Brief integre au hero /assistant" -ForegroundColor Green
Write-Host "[OK] CTA prochaine action" -ForegroundColor Green
Write-Host "[OK] Urgences signalees" -ForegroundColor Green
Write-Host ""
Write-Host "12.38 appliquee. Aucune migration SQL." -ForegroundColor Cyan
