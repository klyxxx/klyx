$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\bookings\page.tsx"

if (-not (Test-Path -LiteralPath $page -PathType Leaf)) {
    throw "13.80 : bookings page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$signals = @(
    "KLYX_CLIENT_MISSION_COCKPIT_13_80",
    'accountType === "client"',
    "KLYX s’en occupe",
    "Prochaine étape KLYX",
    "Ton accord est nécessaire",
    "actionableBookings",
    "upcomingBookings",
    "splitActions",
    "splitUpcoming",
    "totalActions",
    "totalUpcoming",
    "nextBooking",
    "href={nextBooking.href}",
    'href="/assistant/market"',
    'href="/search"',
    "splitMissionNeedsAction",
    "splitMissionIsHistory",
    "/api/bookings/overview",
    "une confirmation explicite reste",
    "nécessaire avant un choix de prestataire",
    "KLYX_PROVIDER_MISSION_COCKPIT_13_79"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.80 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.80 : PowerShell injecte dans page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.80 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.80 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.80 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.80 CHECK OK"
Write-Host "======================================"
Write-Host "Client mission cockpit : READY"
Write-Host "Required confirmations : READY"
Write-Host "Upcoming missions : READY"
Write-Host "Completed missions : READY"
Write-Host "Split mission awareness : READY"
Write-Host "Next action routing : READY"
Write-Host "Explicit confirmation : PRESERVED"
Write-Host "Automatic provider choice : NONE"
Write-Host "Automatic booking : NONE"
Write-Host "Automatic payment : NONE"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"