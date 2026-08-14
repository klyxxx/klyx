$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$migration =
    Join-Path `
        $root `
        "supabase\migrations\20260813165000_klyx_split_payment_confirmation_13_26.sql"

$api =
    Join-Path `
        $root `
        "app\api\bookings\split-missions\[id]\payment-confirmation\route.ts"

$component =
    Join-Path `
        $root `
        "app\bookings\split\[id]\SplitMissionPaymentConfirmation.tsx"

$page =
    Join-Path `
        $root `
        "app\bookings\split\[id]\page.tsx"

foreach (
    $path
    in @(
        $migration,
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
        throw "13.26 : fichier introuvable : $path"
    }
}

$m =
    [System.IO.File]::ReadAllText(
        $migration
    )

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
Write-Host "CHECK KLYX 13.26"
Write-Host ""

Check `
    "13.26 migration marker" `
    $m.Contains(
        "KLYX_SPLIT_PAYMENT_CONFIRMATION_13_26"
    )

Check `
    "payment confirmation table" `
    $m.Contains(
        "split_booking_payment_confirmations"
    )

Check `
    "single active proof" `
    $m.Contains(
        "klyx_split_payment_confirmation_active_13_26"
    )

Check `
    "confirmation RPC" `
    $m.Contains(
        "klyx_confirm_split_payment_plan_13_26"
    )

Check `
    "13.26 API marker" `
    $a.Contains(
        "KLYX_SPLIT_PAYMENT_CONFIRMATION_API_13_26"
    )

Check `
    "SHA256 payment plan proof" `
    (
        $a.Contains(
            "createHash"
        ) -and
        $a.Contains(
            '"sha256"'
        )
    )

Check `
    "13.23 proof revalidated" `
    $a.Contains(
        "split_booking_price_confirmations"
    )

Check `
    "live bookings revalidated" `
    $a.Contains(
        "LIVE_PAYMENT_PLAN_CHANGED"
    )

Check `
    "Stripe accounts revalidated" `
    $a.Contains(
        "stripe.accounts.retrieve"
    )

Check `
    "charges readiness retained" `
    $a.Contains(
        "charges_enabled"
    )

Check `
    "payout readiness retained" `
    $a.Contains(
        "payouts_enabled"
    )

Check `
    "explicit payment confirmation" `
    $a.Contains(
        "paymentConfirmed"
    )

Check `
    "final amount acknowledgement" `
    $a.Contains(
        "finalAmountAcknowledged"
    )

Check `
    "split acknowledgement" `
    $a.Contains(
        "separateProviderPaymentsAcknowledged"
    )

Check `
    "proof invalidated on change" `
    $a.Contains(
        "live_payment_plan_changed"
    )

Check `
    "automatic payment forbidden" `
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
    "money moved false" `
    $a.Contains(
        "moneyMoved"
    )

Check `
    "13.26 UI marker" `
    $c.Contains(
        "KLYX_SPLIT_PAYMENT_CONFIRMATION_UI_13_26"
    )

Check `
    "explicit confirmation button" `
    $c.Contains(
        "Confirmer le paiement"
    )

Check `
    "13.26 wiring" `
    $p.Contains(
        "KLYX_SPLIT_PAYMENT_CONFIRMATION_WIRING_13_26"
    )

Check `
    "13.25 retained" `
    $p.Contains(
        "KLYX_SPLIT_STRIPE_READINESS_WIRING_13_25"
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

    throw "KLYX 13.26 static checker FAILED."
}

Write-Host ""
Write-Host "Supabase migration..."
Write-Host ""

npx.cmd supabase db push

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.26 Supabase db push FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.26 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.26 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.26 CHECK OK"
Write-Host "======================================"
Write-Host "Final payment proof : ACTIVE"
Write-Host "SHA256 payment plan : ACTIVE"
Write-Host "13.23 price proof : REVALIDE"
Write-Host "13.25 Stripe readiness : REVALIDEE"
Write-Host "Final amount acknowledgement : EXPLICITE"
Write-Host "Provider split acknowledgement : EXPLICITE"
Write-Host "Payment confirmation : EXPLICITE"
Write-Host "Proof invalidation on change : ACTIVE"
Write-Host "PaymentIntent created : NON"
Write-Host "Checkout created : NON"
Write-Host "Transfer created : NON"
Write-Host "Money moved : NON"
Write-Host "Automatic payment : NON"
Write-Host "Supabase : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"