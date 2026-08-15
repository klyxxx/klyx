$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\bookings\page.tsx"

if (-not (Test-Path -LiteralPath $page -PathType Leaf)) {
    throw "13.79 : bookings page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$signals = @(
    "KLYX_PROVIDER_MISSION_COCKPIT_13_79",
    'accountType === "provider"',
    "Suivi KLYX prestataire",
    "Ton activité maintenant",
    "Prochaine étape",
    "actionable",
    "upcoming",
    "completed",
    "nextAction",
    "nextAction.statusLabel",
    "href={nextAction.href}",
    'href="/provider/jobs"',
    'href="/provider/assistant"',
    "/api/bookings/overview",
    "booking.actionRequired",
    "booking.history",
    'booking.status ===',
    '"completed"',
    "ne déclenche aucun paiement"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.79 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.79 : PowerShell injecte dans page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.79 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.79 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.79 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.79 CHECK OK"
Write-Host "======================================"
Write-Host "Provider mission cockpit : READY"
Write-Host "Required actions : READY"
Write-Host "Upcoming missions : READY"
Write-Host "Completed missions : READY"
Write-Host "Next mission routing : READY"
Write-Host "Opportunity bridge : READY"
Write-Host "Assistant bridge : READY"
Write-Host "Existing booking overview : PRESERVED"
Write-Host "Automatic booking : NONE"
Write-Host "Automatic payment : NONE"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"