$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.36 - LIVE ASSISTANT PRIORITY" -ForegroundColor Cyan
Write-Host ""

$source = Join-Path $payload "app\components\AssistantPriorityBadge.tsx"
$target = Join-Path $root "app\components\AssistantPriorityBadge.tsx"

if (-not (Test-Path -LiteralPath $source)) {
  throw "Payload AssistantPriorityBadge manquant."
}

New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host "[OK] app\components\AssistantPriorityBadge.tsx" -ForegroundColor Green

$sidebarPath = "app\ui\AppSidebar.tsx"
$sidebar = Get-Content -LiteralPath $sidebarPath -Raw

$importAnchor = 'import KlyxLogo from "@/app/ui/KlyxLogo";'
$badgeImport = 'import AssistantPriorityBadge from "@/app/components/AssistantPriorityBadge";'

if (-not $sidebar.Contains($badgeImport)) {
  if (-not $sidebar.Contains($importAnchor)) {
    throw "Ancre import AppSidebar introuvable."
  }

  $sidebar = $sidebar.Replace(
    $importAnchor,
    "$importAnchor`r`n$badgeImport"
  )
}

$oldTitle = '<span>{item.title}</span>'
$newTitle = @'
              <span>{item.title}</span>

              {item.href === "/assistant" && (
                <AssistantPriorityBadge />
              )}
'@

if ($sidebar.Contains($oldTitle)) {
  $sidebar = $sidebar.Replace(
    $oldTitle,
    $newTitle
  )
}
elseif ($sidebar -notmatch "AssistantPriorityBadge") {
  throw "Rendu titre menu introuvable."
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $sidebarPath),
  $sidebar,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Badge live ajoute au Centre KLYX" -ForegroundColor Green
Write-Host "[OK] Actualisation automatique 30 secondes" -ForegroundColor Green
Write-Host "[OK] Priorite urgente en rouge" -ForegroundColor Green
Write-Host ""
Write-Host "12.36 appliquee. Aucune migration SQL." -ForegroundColor Cyan
