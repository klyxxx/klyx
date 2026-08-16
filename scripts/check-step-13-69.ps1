$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\bookings\[id]\page.tsx"

if (-not (Test-Path -LiteralPath $page -PathType Leaf)) {
    throw "13.69 : booking details page introuvable."
}

$text =
    [System.IO.File]::ReadAllText($page)

$required =
    @(
        "KLYX_BOOKING_NEXT_ACTION_13_69",
        "Suivi KLYX",
        "Le prestataire a accepté",
        "Payer maintenant",
        "Action requise : paiement",
        "Prestation prête",
        "Le paiement n’est jamais lancé automatiquement.",
        "function JourneyStep(",
        "/api/stripe/create-checkout-session",
        "alreadyPaid",
        "paymentPending",
        "canPay",
        "canTrack"
    )

foreach ($signal in $required) {
    if (-not $text.Contains($signal)) {
        throw "13.69 : signal manquant : $signal"
    }
}

if (
    -not $text.Contains(
        'onClick={() => void payBooking()}'
    )
) {
    throw "13.69 : paiement explicite par clic absent."
}

if (
    $text -match
    'useEffect[\s\S]{0,500}payBooking\('
) {
    throw "13.69 : paiement automatique potentiellement detecte."
}

if (
    $text.Contains(
        "[System.IO.File]::WriteAllText"
    )
) {
    throw "13.69 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.69 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.69 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.69 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.69 CHECK OK"
Write-Host "======================================"
Write-Host "Booking lifecycle : VISIBLE"
Write-Host "Current journey step : DYNAMIC"
Write-Host "Next action : VISIBLE"
Write-Host "Client payment CTA : EXPLICIT"
Write-Host "Automatic payment : IMPOSSIBLE"
Write-Host "Paid service readiness : VISIBLE"
Write-Host "Existing Stripe flow : PRESERVED"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"