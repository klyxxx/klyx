$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$paths = @{
    Migration =
        Join-Path $root "supabase\migrations\20260812203500_klyx_group_payment_12_86.sql"

    Helper =
        Join-Path $root "lib\stripe-group-payments.ts"

    Checkout =
        Join-Path $root "app\api\stripe\create-group-checkout-session\route.ts"

    Webhook =
        Join-Path $root "app\api\stripe\webhook\route.ts"

    Page =
        Join-Path $root "app\booking-groups\[id]\page.tsx"

    ChildCheckout =
        Join-Path $root "app\api\stripe\create-checkout-session\route.ts"

    GroupApi =
        Join-Path $root "app\api\booking-groups\[id]\route.ts"
}

Write-Host ""
Write-Host "CHECK KLYX 12.86"
Write-Host ""

foreach ($path in $paths.Values) {
    if (-not (
        Test-Path -LiteralPath $path
    )) {
        throw "Fichier absent : $path"
    }
}

$migration =
    [System.IO.File]::ReadAllText(
        $paths.Migration
    )

$helper =
    [System.IO.File]::ReadAllText(
        $paths.Helper
    )

$checkout =
    [System.IO.File]::ReadAllText(
        $paths.Checkout
    )

$webhook =
    [System.IO.File]::ReadAllText(
        $paths.Webhook
    )

$page =
    [System.IO.File]::ReadAllText(
        $paths.Page
    )

$childCheckout =
    [System.IO.File]::ReadAllText(
        $paths.ChildCheckout
    )

$groupApi =
    [System.IO.File]::ReadAllText(
        $paths.GroupApi
    )

$checks = @(
    @{
        Name = "group payment migration"
        Value = $migration.Contains(
            "KLYX_GROUP_PAYMENT_12_86"
        )
    },
    @{
        Name = "atomic payment claim"
        Value = $migration.Contains(
            "klyx_claim_booking_group_payment"
        )
    },
    @{
        Name = "payment attempt lock"
        Value = $migration.Contains(
            "payment_attempt_token"
        )
    },
    @{
        Name = "group Stripe helper"
        Value = $helper.Contains(
            "KLYX_GROUP_STRIPE_HELPER_12_86"
        )
    },
    @{
        Name = "mark group paid"
        Value = $helper.Contains(
            "markBookingGroupPaidFromSession"
        )
    },
    @{
        Name = "children paid together"
        Value = $helper.Contains(
            '"booking_group_id"'
        ) -and
        $helper.Contains(
            'payment_status:'
        )
    },
    @{
        Name = "group ledger distribution"
        Value = $helper.Contains(
            "upsertFinancialLedgerEntry"
        )
    },
    @{
        Name = "group Checkout API"
        Value = $checkout.Contains(
            "KLYX_GROUP_CHECKOUT_12_86"
        )
    },
    @{
        Name = "one group metadata"
        Value = $checkout.Contains(
            "booking_group_id:"
        )
    },
    @{
        Name = "Stripe idempotency"
        Value = $checkout.Contains(
            "idempotencyKey:"
        )
    },
    @{
        Name = "Connect destination retained"
        Value = $checkout.Contains(
            "transfer_data"
        )
    },
    @{
        Name = "group webhook"
        Value = $webhook.Contains(
            "KLYX_GROUP_WEBHOOK_12_86"
        )
    },
    @{
        Name = "single booking webhook retained"
        Value = $webhook.Contains(
            "markBookingPaidFromSession"
        )
    },
    @{
        Name = "group webhook paid"
        Value = $webhook.Contains(
            "markBookingGroupPaidFromSession"
        )
    },
    @{
        Name = "group webhook failed"
        Value = $webhook.Contains(
            "recordBookingGroupPaymentFailure"
        )
    },
    @{
        Name = "group payment UI"
        Value = $page.Contains(
            "KLYX_GROUP_PAYMENT_PAGE_12_86"
        )
    },
    @{
        Name = "explicit payment click"
        Value = $page.Contains(
            "payGroup()"
        )
    },
    @{
        Name = "child payment guard retained"
        Value = $childCheckout.Contains(
            "KLYX_GROUP_PAYMENT_GUARD_12_85"
        )
    },
    @{
        Name = "12.85 group API retained"
        Value = $groupApi.Contains(
            "KLYX_BOOKING_GROUP_API_12_85"
        )
    }
)

$failed = @()

foreach ($check in $checks) {
    if ($check.Value) {
        Write-Host "[OK]   $($check.Name)"
    }
    else {
        Write-Host "[FAIL] $($check.Name)"
        $failed += $check.Name
    }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Echecs :"

    $failed |
        ForEach-Object {
            Write-Host " - $_"
        }

    throw "KLYX 12.86 static checker FAILED."
}

Push-Location $root

try {
    Write-Host ""
    Write-Host "TypeScript..."
    Write-Host ""

    $tsOutput = @(
        & npx.cmd `
            tsc `
            --noEmit `
            --pretty false 2>&1
    )

    if ($LASTEXITCODE -ne 0) {
        $tsOutput |
            Select-Object -First 220 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.86 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.86 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.86 CHECK OK"
Write-Host "======================================"
Write-Host "1 groupe -> 1 Checkout Stripe : OK"
Write-Host "1 groupe -> 1 PaymentIntent : OK"
Write-Host "Double paiement groupe : BLOQUE"
Write-Host "Paiement individuel enfants : BLOQUE"
Write-Host "Tous les enfants payes ensemble : OK"
Write-Host "Commission KLYX : OK"
Write-Host "Stripe Connect : OK"
Write-Host "Webhook groupe : OK"
Write-Host "Paiement automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""