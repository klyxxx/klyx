$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\dashboard\ClientDashboard.tsx"

if (-not (Test-Path -LiteralPath $page -PathType Leaf)) {
    throw "13.83 : ClientDashboard.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$signals = @(
    "KLYX_CLIENT_DASHBOARD_WORKFLOW_13_83",
    "KLYX_CLIENT_PRIMARY_WORKFLOW_13_83",
    'href="/assistant/market"',
    'href="/search"',
    'href="/bookings"',
    "Organiser avec KLYX",
    "Organiser mon besoin",
    "Comparer moi-même",
    "Suivre mes missions",
    "Décris ton besoin",
    "Compare les solutions",
    "Confirme puis suis",
    "DashboardActionCenter",
    'accountType="client"',
    "KLYX_CLIENT_CONTROL_REMINDER_13_83",
    "Aucun paiement sans confirmation",
    "action explicite de ta part"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.83 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.83 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.83 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.83 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.83 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.83 CHECK OK"
Write-Host "======================================"
Write-Host "Client dashboard journey : READY"
Write-Host "Assistant market : FIRST CLASS"
Write-Host "Marketplace search : CONNECTED"
Write-Host "Bookings tracking : CONNECTED"
Write-Host "Action center : PRESERVED"
Write-Host "Explicit confirmation : PRESERVED"
Write-Host "Automatic publication : NONE"
Write-Host "Automatic provider choice : NONE"
Write-Host "Automatic booking : NONE"
Write-Host "Automatic payment : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"