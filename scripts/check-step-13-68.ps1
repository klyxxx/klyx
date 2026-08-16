$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\quotes\[id]\book\page.tsx"

if (
    -not (
        Test-Path `
            -LiteralPath $page `
            -PathType Leaf
    )
) {
    throw "13.68 : quote booking page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$required =
    @(
        "KLYX_BOOKING_CONTINUITY_13_68",
        "Prestataire choisi",
        "Confirmer le créneau",
        "Paiement",
        "Aucun paiement n’est effectué sur cet écran.",
        "Dernière vérification avant réservation",
        "Confirmer et créer la réservation",
        "/api/bookings/create",
        "quoteId: quote.id",
        '/bookings/${body.bookingId}?created=1&quote=1'
    )

foreach ($signal in $required) {
    if (
        -not $text.Contains(
            $signal
        )
    ) {
        throw (
            "13.68 : signal manquant : " +
            $signal
        )
    }
}

if (
    $text -match
    '(?i)payment.*fetch'
) {
    throw "13.68 : appel paiement detecte dans cette page."
}

if (
    $text.Contains(
        "[System.IO.File]::WriteAllText"
    )
) {
    throw "13.68 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.68 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.68 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.68 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.68 CHECK OK"
Write-Host "======================================"
Write-Host "Provider selected state : VISIBLE"
Write-Host "Booking confirmation step : VISIBLE"
Write-Host "Final booking summary : VISIBLE"
Write-Host "Booking creation API : PRESERVED"
Write-Host "Payment on this screen : NONE"
Write-Host "Booking/payment separation : PRESERVED"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"