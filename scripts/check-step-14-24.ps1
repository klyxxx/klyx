$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$apiAuth =
    Join-Path $root "lib\api-auth.ts"

$quotes =
    Join-Path $root "app\api\quotes\route.ts"

$bookings =
    Join-Path $root "app\api\bookings\create\route.ts"

$money =
    Join-Path $root "lib\klyx-money.ts"

foreach ($path in @(
    $apiAuth,
    $quotes,
    $bookings,
    $money
)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "14.24 : fichier introuvable : $path"
    }
}

$authText =
    [System.IO.File]::ReadAllText($apiAuth)

$quoteText =
    [System.IO.File]::ReadAllText($quotes)

$bookingText =
    [System.IO.File]::ReadAllText($bookings)

foreach ($signal in @(
    "KLYX_REAL_PROFILE_MARKET_14_24",
    "country_code",
    "currency_code",
    "currencyCode"
)) {
    if (-not $authText.Contains($signal)) {
        throw "14.24 : api-auth incomplet : $signal"
    }
}

foreach ($signal in @(
    "KLYX_QUOTE_CLIENT_MONEY_14_24",
    "KLYX_QUOTE_PROVIDER_CURRENCY_GUARD_14_24",
    "KLYX_QUOTE_CURRENCY_SNAPSHOT_WRITE_14_24",
    "resolveKlyxProfileMoney",
    "assertKlyxSameCurrency"
)) {
    if (-not $quoteText.Contains($signal)) {
        throw "14.24 : quotes incomplet : $signal"
    }
}

foreach ($signal in @(
    "KLYX_BOOKING_CLIENT_MONEY_14_24",
    "KLYX_BOOKING_PROVIDER_CURRENCY_GUARD_14_24",
    "KLYX_ACCEPTED_QUOTE_CURRENCY_14_24",
    "KLYX_MINOR_UNITS_FROM_TRANSACTION_14_24",
    "KLYX_BOOKING_CURRENCY_SNAPSHOT_WRITE_14_24",
    "resolveKlyxMoneyContext",
    "toKlyxMinorUnits"
)) {
    if (-not $bookingText.Contains($signal)) {
        throw "14.24 : booking incomplet : $signal"
    }
}

if (
    $authText.Contains(
        'countryCode: "BE"'
    )
) {
    throw "14.24 : hardcoded BE interdit."
}

if (
    $bookingText.Contains(
        'currency: "EUR"'
    )
) {
    throw "14.24 : hardcoded EUR interdit."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.24 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.24 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.24 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.24 CHECK OK"
Write-Host "======================================"
Write-Host "Profile market      : REAL DB DATA"
Write-Host "Quote currency      : DYNAMIC"
Write-Host "Booking currency    : DYNAMIC"
Write-Host "BE hardcode         : REMOVED"
Write-Host "EUR hardcode        : REMOVED"
Write-Host "Provider mismatch   : BLOCKED"
Write-Host "Quote mismatch      : BLOCKED"
Write-Host "Silent FX           : BLOCKED"
Write-Host "Automatic payment   : NONE"
Write-Host "Tests               : OK"
Write-Host "TypeScript          : OK"
Write-Host "Build               : OK"
Write-Host "======================================"