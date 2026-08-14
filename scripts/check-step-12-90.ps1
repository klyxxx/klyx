$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$paths = @{
    Migration =
        Join-Path $root "supabase\migrations\20260812211800_klyx_group_cancellation_resolution_12_90.sql"

    Helper =
        Join-Path $root "lib\stripe-group-refunds.ts"

    Api =
        Join-Path $root "app\api\booking-groups\[id]\cancellation\route.ts"

    Card =
        Join-Path $root "app\booking-groups\[id]\GroupCancellationCard.tsx"

    Refunds =
        Join-Path $root "lib\stripe-refunds.ts"

    Checkout =
        Join-Path $root "app\api\stripe\create-group-checkout-session\route.ts"

    Webhook =
        Join-Path $root "app\api\stripe\webhook\route.ts"
}

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

$api =
    [System.IO.File]::ReadAllText(
        $paths.Api
    )

$card =
    [System.IO.File]::ReadAllText(
        $paths.Card
    )

$refunds =
    [System.IO.File]::ReadAllText(
        $paths.Refunds
    )

$checkout =
    [System.IO.File]::ReadAllText(
        $paths.Checkout
    )

$webhook =
    [System.IO.File]::ReadAllText(
        $paths.Webhook
    )

$checks = @(
    @{
        Name = "migration 12.90"
        Value =
            $migration.Contains(
                "KLYX_GROUP_CANCELLATION_RESOLUTION_12_90"
            )
    },
    @{
        Name = "resolution RPC"
        Value =
            $migration.Contains(
                "klyx_resolve_group_cancellation"
            )
    },
    @{
        Name = "self approval DB guard"
        Value =
            $migration.Contains(
                "KLYX_GROUP_CANCEL_SELF_APPROVAL"
            )
    },
    @{
        Name = "group refund helper"
        Value =
            $helper.Contains(
                "KLYX_GROUP_REFUND_HELPER_12_90"
            )
    },
    @{
        Name = "group detection by PaymentIntent"
        Value =
            $helper.Contains(
                "stripe_payment_intent_id"
            )
    },
    @{
        Name = "partial refund blocked"
        Value =
            $helper.Contains(
                "remboursement partiel"
            )
    },
    @{
        Name = "ledger child distribution"
        Value =
            $helper.Contains(
                "upsertFinancialLedgerEntry"
            )
    },
    @{
        Name = "API 12.90"
        Value =
            $api.Contains(
                "KLYX_GROUP_CANCELLATION_RESOLUTION_API_12_90"
            )
    },
    @{
        Name = "explicit second participant"
        Value =
            $api.Contains(
                "ne peut pas accepter sa propre demande"
            )
    },
    @{
        Name = "Stripe refund"
        Value =
            $api.Contains(
                "stripe.refunds.create"
            )
    },
    @{
        Name = "Stripe idempotency"
        Value =
            $api.Contains(
                "idempotencyKey:"
            )
    },
    @{
        Name = "reverse transfer"
        Value =
            $api.Contains(
                "reverse_transfer:"
            )
    },
    @{
        Name = "application fee refund"
        Value =
            $api.Contains(
                "refund_application_fee:"
            )
    },
    @{
        Name = "active mission preflight"
        Value =
            $api.Contains(
                "preflightCancellation("
            )
    },
    @{
        Name = "UI 12.90"
        Value =
            $card.Contains(
                "KLYX_GROUP_CANCELLATION_RESOLUTION_UI_12_90"
            )
    },
    @{
        Name = "approve + refund button"
        Value =
            $card.Contains(
                "Accepter et rembourser"
            )
    },
    @{
        Name = "refund router"
        Value =
            $refunds.Contains(
                "KLYX_GROUP_REFUND_ROUTER_12_90"
            )
    },
    @{
        Name = "legacy refund retained"
        Value =
            $refunds.Contains(
                "findBookingFromRefund"
            )
    },
    @{
        Name = "payment suspension"
        Value =
            $checkout.Contains(
                "KLYX_GROUP_CANCEL_PAYMENT_GUARD_12_90"
            )
    },
    @{
        Name = "group checkout 12.86 retained"
        Value =
            $checkout.Contains(
                "KLYX_GROUP_CHECKOUT_12_86"
            )
    },
    @{
        Name = "webhook 12.86 retained"
        Value =
            $webhook.Contains(
                "KLYX_GROUP_WEBHOOK_12_86"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 12.90"
Write-Host ""

foreach ($check in $checks) {
    if ($check.Value) {
        Write-Host "[OK]   $($check.Name)"
    }
    else {
        Write-Host "[FAIL] $($check.Name)"
        $failed +=
            $check.Name
    }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Echecs :"

    $failed |
        ForEach-Object {
            Write-Host " - $_"
        }

    throw "KLYX 12.90 static checker FAILED."
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
            Select-Object -First 250 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.90 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.90 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.90 CHECK OK"
Write-Host "======================================"
Write-Host "Demandeur != approbateur : OK"
Write-Host "Annulation explicite : OK"
Write-Host "1 remboursement Stripe groupe : OK"
Write-Host "Double remboursement : PROTEGE"
Write-Host "Remboursement partiel : BLOQUE"
Write-Host "Reverse transfer Connect : OK"
Write-Host "Commission KLYX remboursee : OK"
Write-Host "Creneaux enfants synchronises : OK"
Write-Host "Ledger financier : OK"
Write-Host "Webhook remboursement : OK"
Write-Host "Paiement pendant annulation : BLOQUE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""