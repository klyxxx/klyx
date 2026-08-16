$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$headerPath =
    Join-Path `
        $root `
        "app\dashboard\Header.tsx"

$dashboardPath =
    Join-Path `
        $root `
        "app\dashboard\page.tsx"

foreach ($filePath in @(
    $headerPath,
    $dashboardPath
)) {
    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        throw "13.92 : fichier introuvable : $filePath"
    }
}

$headerText =
    [System.IO.File]::ReadAllText(
        $headerPath
    )

$dashboardText =
    [System.IO.File]::ReadAllText(
        $dashboardPath
    )

$signals = @(
    "KLYX_DASHBOARD_ROLE_HEADER_13_92",
    "KLYX_ACTIVE_ROLE_BADGE_13_92",
    "KLYX_DASHBOARD_PRIMARY_ACTIONS_13_92",
    "KLYX_ACTIVE_CONNECTION_CONTEXT_13_92",
    "KLYX_DASHBOARD_ROLE_GUIDANCE_13_92",
    "/provider/jobs",
    "/assistant/market",
    "/accounts",
    "Voir mes opportunités",
    "Organiser un besoin",
    "Gérer mes profils",
    "Profil actif",
    "NotificationBell",
    "Console Founder",
    "Admin"
)

foreach ($signal in $signals) {
    if (-not $headerText.Contains($signal)) {
        throw "13.92 : Header signal manquant : $signal"
    }
}

$dashboardSignals = @(
    "Header",
    "displayName",
    "accountType={profile.accountType}",
    "AccountSwitcher",
    "currentProfileId={profile.id}",
    "ClientDashboard",
    "ProviderDashboard"
)

foreach ($signal in $dashboardSignals) {
    if (-not $dashboardText.Contains($signal)) {
        throw "13.92 : dashboard signal manquant : $signal"
    }
}

if ($headerText.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.92 : PowerShell injecte dans Header.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.92 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.92 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.92 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.92 CHECK OK"
Write-Host "======================================"
Write-Host "Dashboard header : READY"
Write-Host "Active role context : READY"
Write-Host "Client action : READY"
Write-Host "Provider action : READY"
Write-Host "Account manager access : READY"
Write-Host "Account switcher : PRESERVED"
Write-Host "Notifications : PRESERVED"
Write-Host "Founder/admin : PRESERVED"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"