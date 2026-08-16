$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$money =
    Join-Path `
        $root `
        "lib\klyx-money.ts"

$test =
    Join-Path `
        $root `
        "tests\unit\klyx-money.test.ts"

foreach ($path in @(
    $money,
    $test
)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "14.22 : fichier introuvable : $path"
    }
}

$moneyText =
    [System.IO.File]::ReadAllText(
        $money
    )

$testText =
    [System.IO.File]::ReadAllText(
        $test
    )

foreach ($signal in @(
    "KLYX_TRANSACTION_CURRENCY_CONTRACT_14_22",
    "KLYX_PROFILE_CURRENCY_GUARD_14_22",
    "KLYX_STRIPE_CURRENCY_FROM_MARKET_14_22",
    "KLYX_NO_SILENT_FX_14_22",
    "KLYX_NO_AUTOMATIC_PAYMENT_14_22",
    "resolveKlyxMoneyContext",
    "resolveKlyxProfileMoney",
    "toKlyxMinorUnits",
    "fromKlyxMinorUnits",
    "getKlyxStripeCurrency",
    "assertKlyxSameCurrency",
    "KLYX_CURRENCY_MARKET_MISMATCH",
    "KLYX_TRANSACTION_CURRENCY_MISMATCH",
    "KLYX_SILENT_CURRENCY_CONVERSION_ALLOWED",
    "KLYX_AUTOMATIC_PAYMENT_ALLOWED"
)) {
    if (-not $moneyText.Contains($signal)) {
        throw "14.22 : contrat incomplet : $signal"
    }
}

foreach ($signal in @(
    "KLYX_MONEY_CONTRACT_TESTS_14_22",
    '"BE"',
    '"EUR"',
    '"US"',
    '"USD"',
    '"CA"',
    '"CAD"',
    '"AU"',
    '"AUD"',
    "1234",
    "rejects Canada with USD",
    "rejects cross-currency transactions"
)) {
    if (-not $testText.Contains($signal)) {
        throw "14.22 : test incomplet : $signal"
    }
}

if (
    $moneyText.Contains(
        "KLYX_SILENT_CURRENCY_CONVERSION_ALLOWED =" +
        "`r`n  true"
    )
) {
    throw "14.22 : conversion FX silencieuse interdite."
}

if (
    $moneyText.Contains(
        "KLYX_AUTOMATIC_PAYMENT_ALLOWED =" +
        "`r`n  true"
    )
) {
    throw "14.22 : paiement automatique interdit."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.22 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.22 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.22 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.22 CHECK OK"
Write-Host "======================================"
Write-Host "Global money       : READY"
Write-Host "EUR                : READY"
Write-Host "USD                : READY"
Write-Host "CAD/AUD/etc.       : READY"
Write-Host "Market mismatch    : BLOCKED"
Write-Host "Cross currency     : BLOCKED"
Write-Host "Minor units        : READY"
Write-Host "Stripe mapping     : READY"
Write-Host "Silent FX          : BLOCKED"
Write-Host "Automatic payment  : BLOCKED"
Write-Host "Tests              : OK"
Write-Host "TypeScript         : OK"
Write-Host "Build              : OK"
Write-Host "======================================"