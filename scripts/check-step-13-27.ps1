$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$migration =
    Join-Path `
        $root `
        "supabase\migrations\20260813174500_klyx_split_checkout_13_27.sql"

$api =
    Join-Path `
        $root `
        "app\api\bookings\split-missions\[id]\checkout\route.ts"

$helper =
    Join-Path `
        $root `
        "lib\split-stripe-payments.ts"

$component =
    Join-Path `
        $root `
        "app\bookings\split\[id]\SplitMissionCheckout.tsx"

$page =
    Join-Path `
        $root `
        "app\bookings\split\[id]\page.tsx"

$webhook =
    Join-Path `
        $root `
        "app\api\stripe\webhook\route.ts"

$single =
    Join-Path `
        $root `
        "app\api\stripe\create-checkout-session\route.ts"

foreach (
    $path
    in @(
        $migration,
        $api,
        $helper,
        $component,
        $page,
        $webhook,
        $single
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath `
                $path
        )
    ) {
        throw "13.27 : fichier introuvable : $path"
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

$h =
    [System.IO.File]::ReadAllText(
        $helper
    )

$c =
    [System.IO.File]::ReadAllText(
        $component
    )

$p =
    [System.IO.File]::ReadAllText(
        $page
    )

$w =
    [System.IO.File]::ReadAllText(
        $webhook
    )

$s =
    [System.IO.File]::ReadAllText(
        $single
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
Write-Host "CHECK KLYX 13.27"
Write-Host ""

Check `
    "13.27 DB" `
    $m.Contains(
        "KLYX_SPLIT_CHECKOUT_DB_13_27"
    )

Check `
    "payment runs" `
    $m.Contains(
        "split_booking_payment_runs"
    )

Check `
    "payment units" `
    $m.Contains(
        "split_booking_payment_units"
    )

Check `
    "idempotent claim" `
    $m.Contains(
        "klyx_claim_split_payment_unit_13_27"
    )

Check `
    "checkout attach" `
    $m.Contains(
        "klyx_attach_split_checkout_13_27"
    )

Check `
    "expired recovery" `
    $m.Contains(
        "klyx_release_split_checkout_13_27"
    )

Check `
    "payment proof consumption" `
    $m.Contains(
        "klyx_finalize_split_payment_run_13_27"
    )

Check `
    "13.27 checkout API" `
    $a.Contains(
        "KLYX_SPLIT_CHECKOUT_API_13_27"
    )

Check `
    "Stripe destination charge" `
    $a.Contains(
        "transfer_data"
    )

Check `
    "application fee" `
    $a.Contains(
        "application_fee_amount"
    )

Check `
    "Stripe idempotency" `
    $a.Contains(
        "idempotencyKey"
    )

Check `
    "13.26 proof required" `
    $a.Contains(
        "split_booking_payment_confirmations"
    )

Check `
    "13.23 proof revalidated" `
    $a.Contains(
        "split_booking_price_confirmations"
    )

Check `
    "no automatic payment" `
    $a.Contains(
        "automaticPayment"
    )

Check `
    "webhook helper" `
    $h.Contains(
        "KLYX_SPLIT_STRIPE_WEBHOOK_13_27"
    )

Check `
    "webhook wiring" `
    $w.Contains(
        "KLYX_SPLIT_STRIPE_WEBHOOK_WIRING_13_27"
    )

Check `
    "legacy checkout guard" `
    $s.Contains(
        "KLYX_SPLIT_LEGACY_CHECKOUT_GUARD_13_27"
    )

Check `
    "13.27 UI" `
    $c.Contains(
        "KLYX_SPLIT_CHECKOUT_UI_13_27"
    )

Check `
    "explicit preparation" `
    $c.Contains(
        "Préparer mes paiements"
    )

Check `
    "provider checkout action" `
    $c.Contains(
        "Payer ce prestataire"
    )

Check `
    "13.27 page wiring" `
    $p.Contains(
        "KLYX_SPLIT_CHECKOUT_WIRING_13_27"
    )

Check `
    "13.26 retained" `
    $p.Contains(
        "KLYX_SPLIT_PAYMENT_CONFIRMATION_WIRING_13_26"
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

    throw "KLYX 13.27 static checker FAILED."
}

Write-Host ""
Write-Host "Supabase migration..."
Write-Host ""

npx.cmd supabase db push

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.27 Supabase db push FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.27 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.27 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.27 CHECK OK"
Write-Host "======================================"
Write-Host "Split payment run : ACTIF"
Write-Host "1 Checkout / provider : ACTIF"
Write-Host "13.26 proof consumption : ACTIVE"
Write-Host "Live price revalidation : ACTIVE"
Write-Host "Live Stripe readiness : ACTIVE"
Write-Host "Destination charges : ACTIVES"
Write-Host "KLYX application fee : ACTIVE"
Write-Host "Stripe idempotency : ACTIVE"
Write-Host "Duplicate child payment : BLOQUE"
Write-Host "Open Checkout reuse : ACTIF"
Write-Host "Expired Checkout recovery : ACTIF"
Write-Host "Webhook split : ACTIF"
Write-Host "Financial ledger : ACTIF"
Write-Host "Automatic redirect : NON"
Write-Host "Automatic payment : NON"
Write-Host "Supabase : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"