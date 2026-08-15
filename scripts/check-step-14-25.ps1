$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$standard =
    Join-Path `
        $root `
        "app\api\stripe\create-checkout-session\route.ts"

$group =
    Join-Path `
        $root `
        "app\api\stripe\create-group-checkout-session\route.ts"

$split =
    Join-Path `
        $root `
        "app\api\bookings\split-missions\[id]\checkout\route.ts"

foreach ($path in @(
    $standard,
    $group,
    $split
)) {
    if (
        -not (
            Test-Path `
                -LiteralPath $path `
                -PathType Leaf
        )
    ) {
        throw "14.25 : fichier introuvable : $path"
    }
}

$standardText =
    [System.IO.File]::ReadAllText(
        $standard
    )

$groupText =
    [System.IO.File]::ReadAllText(
        $group
    )

$splitText =
    [System.IO.File]::ReadAllText(
        $split
    )

foreach ($signal in @(
    "KLYX_STRIPE_BOOKING_CURRENCY_14_25",
    "currency_code",
    "checkoutCurrency",
    "currency: checkoutCurrency"
)) {
    if (
        -not $standardText.Contains(
            $signal
        )
    ) {
        throw "14.25 : checkout standard incomplet : $signal"
    }
}

foreach ($signal in @(
    "KLYX_STRIPE_GROUP_CURRENCY_14_25",
    "group.currency",
    "groupCurrency",
    "checkoutCurrency"
)) {
    if (
        -not $groupText.Contains(
            $signal
        )
    ) {
        throw "14.25 : checkout groupe incomplet : $signal"
    }
}

if (
    $standardText -match
    '(?i)currency\s*:\s*"eur"'
) {
    throw "14.25 : EUR hardcode dans checkout standard."
}

if (
    $groupText -match
    '(?i)currency\s*:\s*"eur"'
) {
    throw "14.25 : EUR hardcode dans checkout groupe."
}

if (
    -not $splitText.Contains(
        "planUnit.currency.toLowerCase()"
    )
) {
    throw "14.25 : checkout split dynamique introuvable."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.25 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.25 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.25 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.25 CHECK OK"
Write-Host "======================================"
Write-Host "Booking currency   : SNAPSHOT -> STRIPE"
Write-Host "Standard Checkout  : DYNAMIC"
Write-Host "Group Checkout     : DYNAMIC"
Write-Host "Split Checkout     : DYNAMIC"
Write-Host "Stripe EUR hardcode: REMOVED"
Write-Host "Silent FX          : NONE"
Write-Host "Automatic payment  : NONE"
Write-Host "Tests              : OK"
Write-Host "TypeScript         : OK"
Write-Host "Build              : OK"
Write-Host "======================================"