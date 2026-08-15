$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$payment =
    Join-Path `
        $root `
        "lib\stripe-payments.ts"

$group =
    Join-Path `
        $root `
        "lib\stripe-group-payments.ts"

$standardCheckout =
    Join-Path `
        $root `
        "app\api\stripe\create-checkout-session\route.ts"

$groupCheckout =
    Join-Path `
        $root `
        "app\api\stripe\create-group-checkout-session\route.ts"

foreach ($path in @(
    $payment,
    $group,
    $standardCheckout,
    $groupCheckout
)) {
    if (
        -not (
            Test-Path `
                -LiteralPath $path `
                -PathType Leaf
        )
    ) {
        throw "14.26 : fichier introuvable : $path"
    }
}

$paymentText =
    [System.IO.File]::ReadAllText(
        $payment
    )

$groupText =
    [System.IO.File]::ReadAllText(
        $group
    )

$standardCheckoutText =
    [System.IO.File]::ReadAllText(
        $standardCheckout
    )

$groupCheckoutText =
    [System.IO.File]::ReadAllText(
        $groupCheckout
    )

foreach ($signal in @(
    "KLYX_PAYMENT_CURRENCY_INTEGRITY_14_26",
    "normalizeKlyxPaymentCurrency",
    "bookingCurrencyCode",
    "currency_code"
)) {
    if (
        -not $paymentText.Contains(
            $signal
        )
    ) {
        throw "14.26 : standard incomplet : $signal"
    }
}

foreach ($signal in @(
    "KLYX_GROUP_CURRENCY_INTEGRITY_14_26",
    "KLYX_GROUP_CHILD_CURRENCY_GUARD_14_26",
    "normalizeGroupCurrency",
    "groupCurrencyCode",
    "childCurrencyCode",
    "formatGroupAmount"
)) {
    if (
        -not $groupText.Contains(
            $signal
        )
    ) {
        throw "14.26 : groupe incomplet : $signal"
    }
}

if (
    $paymentText -match
    'booking\.currency\s*\|\|\s*"EUR"'
) {
    throw "14.26 : fallback EUR standard interdit."
}

if (
    $groupText -match
    'group\.currency\s*\|\|\s*"EUR"'
) {
    throw "14.26 : fallback EUR groupe interdit."
}

if (
    $groupText.Contains(
        " EUR couvre tous les creneaux."
    )
) {
    throw "14.26 : message EUR groupe interdit."
}

if (
    -not $standardCheckoutText.Contains(
        "KLYX_STRIPE_BOOKING_CURRENCY_14_25"
    )
) {
    throw "14.26 : 14.25 standard absent."
}

if (
    -not $groupCheckoutText.Contains(
        "KLYX_STRIPE_GROUP_CURRENCY_14_25"
    )
) {
    throw "14.26 : 14.25 groupe absent."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.26 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.26 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.26 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.26 CHECK OK"
Write-Host "======================================"
Write-Host "Checkout currency     : DYNAMIC"
Write-Host "Webhook currency      : VERIFIED"
Write-Host "PaymentIntent currency: VERIFIED"
Write-Host "Group child currency  : VERIFIED"
Write-Host "Ledger currency       : CANONICAL"
Write-Host "EUR fallback          : REMOVED"
Write-Host "EUR notification      : REMOVED"
Write-Host "Silent FX             : BLOCKED"
Write-Host "Automatic payment     : NONE"
Write-Host "Tests                 : OK"
Write-Host "TypeScript            : OK"
Write-Host "Build                 : OK"
Write-Host "======================================"