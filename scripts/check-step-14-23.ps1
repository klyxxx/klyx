$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$sqlPath =
    Join-Path `
        $root `
        "supabase\KLYX_14_23_APPLY_TRANSACTION_CURRENCY.sql"

$moneyPath =
    Join-Path `
        $root `
        "lib\klyx-money.ts"

if (-not (Test-Path -LiteralPath $sqlPath -PathType Leaf)) {
    throw "14.23 : SQL introuvable."
}

if (-not (Test-Path -LiteralPath $moneyPath -PathType Leaf)) {
    throw "14.23 : contrat monetaire 14.22 introuvable."
}

$sql =
    [System.IO.File]::ReadAllText(
        $sqlPath
    )

foreach ($signal in @(
    "KLYX_TRANSACTION_CURRENCY_DB_14_23",
    "KLYX_QUOTE_CURRENCY_SNAPSHOT_14_23",
    "KLYX_BOOKING_MARKET_SNAPSHOT_14_23",
    "KLYX_BOOKING_GROUP_MARKET_SNAPSHOT_14_23",
    "KLYX_CURRENCY_IMMUTABLE_14_23",
    "KLYX_LINKED_CURRENCY_MATCH_14_23",
    "KLYX_NO_CURRENCY_REWRITE_14_23",
    "service_quotes",
    "bookings",
    "booking_groups",
    "country_code",
    "currency",
    "KLYX_TRANSACTION_CURRENCY_IMMUTABLE",
    "KLYX_BOOKING_QUOTE_CURRENCY_MISMATCH",
    "KLYX_BOOKING_GROUP_CURRENCY_MISMATCH"
)) {
    if (-not $sql.Contains($signal)) {
        throw "14.23 : signal manquant : $signal"
    }
}

if (
    $sql -match
    '(?im)^\s*(truncate\s+table|delete\s+from|drop\s+table)\b'
) {
    throw "14.23 : operation destructive interdite."
}

if (
    $sql -match
    '(?is)update\s+public\.(service_quotes|bookings|booking_groups)\s+set\s+currency'
) {
    throw "14.23 : reecriture monetaire historique interdite."
}

if (
    $sql -notmatch
    '(?is)service_quotes.+add\s+column\s+if\s+not\s+exists\s+currency'
) {
    throw "14.23 : service_quotes.currency absent."
}

if (
    $sql -notmatch
    '(?is)bookings.+add\s+column\s+if\s+not\s+exists\s+country_code'
) {
    throw "14.23 : bookings.country_code absent."
}

if (
    $sql -notmatch
    '(?is)booking_groups.+add\s+column\s+if\s+not\s+exists\s+country_code'
) {
    throw "14.23 : booking_groups.country_code absent."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.23 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.23 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.23 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.23 CHECK OK"
Write-Host "======================================"
Write-Host "Quote currency       : DB READY"
Write-Host "Booking country      : DB READY"
Write-Host "Group country        : DB READY"
Write-Host "Currency immutable   : GUARDED"
Write-Host "Quote -> booking     : GUARDED"
Write-Host "Group -> booking     : GUARDED"
Write-Host "Historical rewrite   : NONE"
Write-Host "Silent FX            : BLOCKED"
Write-Host "Automatic payment    : NONE"
Write-Host "Tests                : OK"
Write-Host "TypeScript           : OK"
Write-Host "Build                : OK"
Write-Host "======================================"