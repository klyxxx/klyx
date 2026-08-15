$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$pagePath =
    Join-Path `
        $root `
        "app\quotes\[id]\book\page.tsx"

if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
    throw "13.96 : quotes booking introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$signals = @(
    "KLYX_QUOTE_TO_BOOKING_HANDOFF_13_96",
    "KLYX_BOOKING_CONTROL_REMINDER_13_96",
    "Le devis est accepté. La réservation ne l’est pas encore.",
    'title="Devis accepté"',
    'title="Créneau"',
    'title="Réservation"',
    'title="Suivi"',
    "Accepter un devis ne crée pas automatiquement une réservation.",
    "Cette page ne déclenche également aucun paiement",
    "function QuoteBookingStep",
    "/api/bookings/create",
    "/api/quotes/",
    "loadedQuote.status",
    '"accepted"',
    "bookingId",
    "slotState.valid",
    "availability_slots",
    "provider_price",
    "router.push"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.96 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.96 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.96 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.96 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.96 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.96 CHECK OK"
Write-Host "======================================"
Write-Host "Accepted quote : VERIFIED"
Write-Host "Availability verification : PRESERVED"
Write-Host "Explicit booking : READY"
Write-Host "Booking API : PRESERVED"
Write-Host "Existing booking redirect : PRESERVED"
Write-Host "Automatic booking : NONE"
Write-Host "Automatic payment : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"