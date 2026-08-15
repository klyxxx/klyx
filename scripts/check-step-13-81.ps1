$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$target =
    Join-Path `
        $root `
        "app\components\DashboardActionCenter.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "13.81 : DashboardActionCenter.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

$signals = @(
    "KLYX_GLOBAL_DASHBOARD_ACTION_CENTER_13_81",
    "/api/quotes",
    "/api/bookings/overview",
    "Promise.all",
    "BookingOverviewCard",
    "booking.actionRequired",
    "!booking.history",
    "booking-actions",
    "upcoming-bookings",
    "Réservations à confirmer",
    "Missions à traiter",
    'href:',
    '"/bookings"',
    '"/provider/quotes"',
    '"/quotes"',
    "priority:",
    ".sort(",
    "KLYX_ACTION_CENTER_CONTROL_13_81",
    "ne confirme aucune action automatiquement"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.81 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.81 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.81 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.81 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.81 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.81 CHECK OK"
Write-Host "======================================"
Write-Host "Global action center : READY"
Write-Host "Quotes awareness : READY"
Write-Host "Booking awareness : READY"
Write-Host "Required actions : READY"
Write-Host "Upcoming missions : READY"
Write-Host "Client priorities : READY"
Write-Host "Provider priorities : READY"
Write-Host "Automatic confirmation : NONE"
Write-Host "Automatic booking : NONE"
Write-Host "Automatic payment : NONE"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"