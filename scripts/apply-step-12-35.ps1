$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.35 - ASSISTANT HOME" -ForegroundColor Cyan
Write-Host ""

$source = Join-Path $payload "app\assistant\page.tsx"
$target = Join-Path $root "app\assistant\page.tsx"

if (-not (Test-Path -LiteralPath $source)) {
  throw "Payload assistant home manquant."
}

New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host "[OK] /assistant" -ForegroundColor Green

$sidebarPath = "app\ui\AppSidebar.tsx"
$sidebar = Get-Content -LiteralPath $sidebarPath -Raw

$clientLine = '  { title: "Vue d’ensemble", href: "/dashboard", icon: LayoutDashboard },'
$providerLine = '  { title: "Tableau professionnel", href: "/dashboard", icon: LayoutDashboard },'
$assistantLine = '  { title: "Centre KLYX", href: "/assistant", icon: Sparkles },'

if ($sidebar -notmatch 'href: "/assistant"') {
  if (-not $sidebar.Contains($clientLine)) {
    throw "Ancre menu client introuvable."
  }

  $sidebar = $sidebar.Replace(
    $clientLine,
    "$clientLine`r`n$assistantLine"
  )

  if (-not $sidebar.Contains($providerLine)) {
    throw "Ancre menu prestataire introuvable."
  }

  $sidebar = $sidebar.Replace(
    $providerLine,
    "$providerLine`r`n$assistantLine"
  )
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $sidebarPath),
  $sidebar,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Centre KLYX ajoute aux deux menus" -ForegroundColor Green
Write-Host "[OK] Priorite Action Center reutilisee" -ForegroundColor Green
Write-Host ""
Write-Host "12.35 appliquee. Aucune migration SQL." -ForegroundColor Cyan
