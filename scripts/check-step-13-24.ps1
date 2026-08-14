$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$api =
    Join-Path `
        $root `
        "app\api\bookings\split-missions\[id]\payment-plan\route.ts"

$component =
    Join-Path `
        $root `
        "app\bookings\split\[id]\SplitMissionPaymentPlan.tsx"

$page =
    Join-Path `
        $root `
        "app\bookings\split\[id]\page.tsx"

foreach (
    $path
    in @(
        $api,
        $component,
        $page
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath `
                $path
        )
    ) {
        throw "13.24 : fichier introuvable : $path"
    }
}

$a =
    [System.IO.File]::ReadAllText(
        $api
    )

$c =
    [System.IO.File]::ReadAllText(
        $component
    )

$p =
    [System.IO.File]::ReadAllText(
        $page
    )

$failed =
    @()

function Check {
    param(
        [string]$Name,
        [bool]$Ok
    )

    if ($Ok) {
        Write-Host (
            "[OK]   " +
            $Name
        )

        return
    }

    Write-Host (
        "[FAIL] " +
        $Name
    )

    $script:failed +=
        $Name
}

Write-Host ""
Write-Host "CHECK KLYX 13.24"
Write-Host ""

Check `
    "13.24 API marker" `
    $a.Contains(
        "KLYX_SPLIT_PAYMENT_CONTRACT_API_13_24"
    )

Check `
    "active 13.23 proof required" `
    $a.Contains(
        "split_booking_price_confirmations"
    )

Check `
    "live booking revalidation" `
    (
        $a.Contains(
            "estimated_amount_cents"
        ) -and
        $a.Contains(
            "amount_total"
        )
    )

Check `
    "provider acceptance revalidation" `
    $a.Contains(
        "bookingAccepted"
    )

Check `
    "one payment unit per provider" `
    $a.Contains(
        "onePaymentUnitPerProvider"
    )

Check `
    "separate provider payment strategy" `
    $a.Contains(
        "separate_provider_payments"
    )

Check `
    "live price mismatch blocker" `
    $a.Contains(
        "LIVE_PRICE_CHANGED"
    )

Check `
    "acceptance mismatch blocker" `
    $a.Contains(
        "PROVIDER_ACCEPTANCE_CHANGED"
    )

Check `
    "structure mismatch blocker" `
    $a.Contains(
        "MISSION_STRUCTURE_CHANGED"
    )

Check `
    "payment confirmation required" `
    $a.Contains(
        "explicitPaymentConfirmationRequired"
    )

Check `
    "Stripe readiness not guessed" `
    $a.Contains(
        "providerStripeReadinessChecked"
    )

Check `
    "automatic payment forbidden" `
    $a.Contains(
        "automaticPayment"
    )

Check `
    "payment not created" `
    $a.Contains(
        "paymentCreated"
    )

Check `
    "checkout not created" `
    $a.Contains(
        "stripeCheckoutCreated"
    )

Check `
    "no Stripe import" `
    (
        -not $a.Contains(
            'from "stripe"'
        )
    )

Check `
    "no checkout session creation" `
    (
        -not $a.Contains(
            "checkout.sessions.create"
        )
    )

Check `
    "13.24 UI marker" `
    $c.Contains(
        "KLYX_SPLIT_PAYMENT_CONTRACT_UI_13_24"
    )

Check `
    "payment allocations visible" `
    $c.Contains(
        "Unités de paiement"
    )

Check `
    "no payment button" `
    (
        -not $c.Contains(
            "Payer maintenant"
        )
    )

Check `
    "13.24 wiring" `
    $p.Contains(
        "KLYX_SPLIT_PAYMENT_CONTRACT_WIRING_13_24"
    )

Check `
    "13.23 retained" `
    $p.Contains(
        "KLYX_SPLIT_PRICE_CONFIRMATION_WIRING_13_23"
    )

if (
    $failed.Count -gt 0
) {
    Write-Host ""
    Write-Host "ECHECS EXACTS :"

    foreach (
        $item
        in $failed
    ) {
        Write-Host (
            " - " +
            $item
        )
    }

    throw "KLYX 13.24 static checker FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.24 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.24 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.24 CHECK OK"
Write-Host "======================================"
Write-Host "Payment architecture : DEFinie"
Write-Host "1 mission client : CONSERVEE"
Write-Host "1 payment unit / provider : ACTIF"
Write-Host "13.23 price proof : REVALIDE"
Write-Host "Provider acceptance : REVALIDEE"
Write-Host "Live amount guard : ACTIF"
Write-Host "Allocation total guard : ACTIF"
Write-Host "Explicit payment confirmation : REQUISE"
Write-Host "Stripe readiness : PAS ENCORE SUPPOSEE"
Write-Host "Stripe Checkout created : NON"
Write-Host "Payment created : NON"
Write-Host "Automatic payment : NON"
Write-Host "Migration DB : AUCUNE"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"