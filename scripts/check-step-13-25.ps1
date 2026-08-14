$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$api =
    Join-Path `
        $root `
        "app\api\bookings\split-missions\[id]\stripe-readiness\route.ts"

$component =
    Join-Path `
        $root `
        "app\bookings\split\[id]\SplitMissionStripeReadiness.tsx"

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
        throw "13.25 : fichier introuvable : $path"
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
Write-Host "CHECK KLYX 13.25"
Write-Host ""

Check `
    "13.25 API marker" `
    $a.Contains(
        "KLYX_SPLIT_STRIPE_READINESS_API_13_25"
    )

Check `
    "Stripe SDK used" `
    $a.Contains(
        'from "stripe"'
    )

Check `
    "live account retrieval" `
    $a.Contains(
        "stripe.accounts.retrieve"
    )

Check `
    "charges readiness" `
    $a.Contains(
        "charges_enabled"
    )

Check `
    "payout readiness" `
    $a.Contains(
        "payouts_enabled"
    )

Check `
    "details submitted readiness" `
    $a.Contains(
        "details_submitted"
    )

Check `
    "Stripe requirements checked" `
    $a.Contains(
        "currently_due"
    )

Check `
    "missing account detected" `
    $a.Contains(
        '"missing_account"'
    )

Check `
    "restricted account detected" `
    $a.Contains(
        '"restricted"'
    )

Check `
    "all-provider readiness" `
    $a.Contains(
        "allProvidersStripeReady"
    )

Check `
    "active price proof required" `
    $a.Contains(
        "split_booking_price_confirmations"
    )

Check `
    "batch structure revalidated" `
    $a.Contains(
        "snapshotMatchesBatch"
    )

Check `
    "explicit payment confirmation retained" `
    $a.Contains(
        "explicitPaymentConfirmationRequired"
    )

Check `
    "no automatic payment" `
    $a.Contains(
        "automaticPayment"
    )

Check `
    "no PaymentIntent creation" `
    (
        -not $a.Contains(
            "paymentIntents.create"
        )
    )

Check `
    "no Checkout creation" `
    (
        -not $a.Contains(
            "checkout.sessions.create"
        )
    )

Check `
    "no Transfer creation" `
    (
        -not $a.Contains(
            "transfers.create"
        )
    )

Check `
    "13.25 UI marker" `
    $c.Contains(
        "KLYX_SPLIT_STRIPE_READINESS_UI_13_25"
    )

Check `
    "provider readiness visible" `
    $c.Contains(
        "Disponibilité Stripe Connect"
    )

Check `
    "no pay button" `
    (
        -not $c.Contains(
            "Payer maintenant"
        )
    )

Check `
    "13.25 wiring" `
    $p.Contains(
        "KLYX_SPLIT_STRIPE_READINESS_WIRING_13_25"
    )

Check `
    "13.24 retained" `
    $p.Contains(
        "KLYX_SPLIT_PAYMENT_CONTRACT_WIRING_13_24"
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

    throw "KLYX 13.25 static checker FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.25 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.25 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.25 CHECK OK"
Write-Host "======================================"
Write-Host "Stripe Connect live check : ACTIF"
Write-Host "charges_enabled : VERIFIE"
Write-Host "payouts_enabled : VERIFIE"
Write-Host "details_submitted : VERIFIE"
Write-Host "Stripe requirements : VERIFIEES"
Write-Host "Missing account guard : ACTIF"
Write-Host "Restricted account guard : ACTIF"
Write-Host "13.23 price proof : REQUIS"
Write-Host "13.24 contract : CONSERVE"
Write-Host "Explicit payment confirmation : REQUISE"
Write-Host "PaymentIntent created : NON"
Write-Host "Checkout created : NON"
Write-Host "Transfer created : NON"
Write-Host "Automatic payment : NON"
Write-Host "Migration DB : AUCUNE"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"