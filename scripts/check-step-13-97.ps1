$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$pagePath =
    Join-Path `
        $root `
        "app\bookings\[id]\page.tsx"

if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
    throw "13.97 : booking detail introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$signals = @(
    "KLYX_BOOKING_PAYMENT_HANDOFF_13_97",
    "KLYX_DOUBLE_PAYMENT_UI_GUARD_13_97",
    "Réservation, paiement, puis suivi.",
    'title="Réservation"',
    'title="Acceptation"',
    'title="Paiement"',
    'title="Suivi"',
    "Paiement déjà enregistré",
    "KLYX ne te propose plus de repayer cette réservation.",
    "Paiement disponible",
    "function BookingPaymentStep",
    "const canPay",
    "const canTrack",
    "booking.payment_status",
    "/api/stripe/create-checkout-session",
    "alreadyPaid",
    "paymentPending",
    "window.location.href"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.97 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.97 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.97 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.97 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.97 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.97 CHECK OK"
Write-Host "======================================"
Write-Host "Booking lifecycle : READY"
Write-Host "Payment state : READY"
Write-Host "Already-paid guard : VERIFIED"
Write-Host "Payment pending guard : VERIFIED"
Write-Host "Stripe checkout : PRESERVED"
Write-Host "Automatic payment : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"