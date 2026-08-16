$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$pagePath =
    Join-Path `
        $root `
        "app\tracking\[bookingId]\page.tsx"

if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
    throw "13.98 : tracking page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$signals = @(
    "KLYX_MISSION_COMPLETION_HANDOFF_13_98",
    "KLYX_TWO_PARTY_COMPLETION_GUARD_13_98",
    "Le prestataire termine. Le client confirme.",
    'title="Mission en cours"',
    'title="Fin déclarée"',
    'title="Client confirme"',
    'title="Avis"',
    "Validation client requise",
    "Mission confirmée",
    "/reviews/",
    "Donner mon avis",
    "function MissionCompletionStep",
    "provider_finished_at",
    "client_confirmed_at",
    "awaitingClientConfirmation",
    "canProviderFinish",
    "canClientConfirm",
    "provider_finished",
    "client_confirmed",
    "/api/bookings/tracking",
    "booking_tracking_events",
    "postgres_changes"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.98 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.98 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.98 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.98 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.98 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.98 CHECK OK"
Write-Host "======================================"
Write-Host "Mission tracking : READY"
Write-Host "Provider completion : READY"
Write-Host "Client confirmation : READY"
Write-Host "Two-party completion : VERIFIED"
Write-Host "Review continuity : READY"
Write-Host "Realtime tracking : PRESERVED"
Write-Host "Automatic completion : NONE"
Write-Host "Automatic review : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"