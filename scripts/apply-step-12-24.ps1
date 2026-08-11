$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.24 - DEMANDES OUVERTES + OFFRES" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "supabase\migrations\20260811_step_12_24_open_requests_offers.sql",
  "app\api\market\requests\route.ts",
  "app\api\market\requests\[id]\offers\route.ts",
  "app\requests\page.tsx",
  "app\provider\jobs\page.tsx"
)

foreach ($relative in $files) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Payload manquant : $relative"
  }

  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  Write-Host "[OK] $relative" -ForegroundColor Green
}

$sidebarPath = "app\ui\AppSidebar.tsx"
$sidebar = Get-Content -LiteralPath $sidebarPath -Raw

if ($sidebar -notmatch 'href: "/requests"') {
  $clientAnchor = '  { title: "Mes devis", href: "/quotes", icon: FileText },'
  if (-not $sidebar.Contains($clientAnchor)) {
    throw "Ancre client Mes devis introuvable."
  }

  $sidebar = $sidebar.Replace(
    $clientAnchor,
    '  { title: "Mes demandes", href: "/requests", icon: ListPlus },' + "`r`n" + $clientAnchor
  )
}

if ($sidebar -notmatch 'href: "/provider/jobs"') {
  $providerAnchor = '  { title: "Demandes de devis", href: "/provider/quotes", icon: FileText },'
  if (-not $sidebar.Contains($providerAnchor)) {
    throw "Ancre provider Demandes de devis introuvable."
  }

  $sidebar = $sidebar.Replace(
    $providerAnchor,
    '  { title: "Missions disponibles", href: "/provider/jobs", icon: BriefcaseBusiness },' + "`r`n" + $providerAnchor
  )
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $sidebarPath),
  $sidebar,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Navigation client + prestataire" -ForegroundColor Green
Write-Host ""
Write-Host "12.24 appliquee." -ForegroundColor Cyan
Write-Host "IMPORTANT : executer la migration SQL dans Supabase avant de tester les pages." -ForegroundColor Yellow
