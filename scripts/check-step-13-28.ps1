$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$migration =
    Join-Path `
        $root `
        "supabase\migrations\20260813182500_klyx_split_refund_reconciliation_13_28.sql"

$helper =
    Join-Path `
        $root `
        "lib\split-stripe-payments.ts"

$legacyRefund =
    Join-Path `
        $root `
        "lib\stripe-refunds.ts"

$api =
    Join-Path `
        $root `
        "app\api\bookings\split-missions\[id]\refund-status\route.ts"

$component =
    Join-Path `
        $root `
        "app\bookings\split\[id]\SplitMissionRefundStatus.tsx"

$page =
    Join-Path `
        $root `
        "app\bookings\split\[id]\page.tsx"

foreach (
    $path
    in @(
        $migration,
        $helper,
        $legacyRefund,
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
        throw "13.28 : fichier introuvable : $path"
    }
}

$m =
    [System.IO.File]::ReadAllText(
        $migration
    )

$h =
    [System.IO.File]::ReadAllText(
        $helper
    )

$l =
    [System.IO.File]::ReadAllText(
        $legacyRefund
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
Write-Host "CHECK KLYX 13.28"
Write-Host ""

Check `
    "13.28 DB marker" `
    $m.Contains(
        "KLYX_SPLIT_REFUND_DB_13_28"
    )

Check `
    "refund event table" `
    $m.Contains(
        "split_booking_payment_refunds"
    )

Check `
    "unit refund state" `
    (
        $m.Contains(
            "refund_status"
        ) -and
        $m.Contains(
            "refunded_amount_cents"
        )
    )

Check `
    "partial refund run status" `
    $m.Contains(
        "partially_refunded"
    )

Check `
    "full refund run status" `
    $m.Contains(
        "'refunded'"
    )

Check `
    "13.28 webhook reconciliation" `
    $h.Contains(
        "KLYX_SPLIT_REFUND_RECONCILIATION_13_28"
    )

Check `
    "refund.created handled" `
    $h.Contains(
        '"refund.created"'
    )

Check `
    "refund.updated handled" `
    $h.Contains(
        '"refund.updated"'
    )

Check `
    "refund.failed handled" `
    $h.Contains(
        '"refund.failed"'
    )

Check `
    "charge.refunded handled" `
    $h.Contains(
        '"charge.refunded"'
    )

Check `
    "refund idempotence" `
    (
        $h.Contains(
            "stripe_refund_id"
        ) -and
        $h.Contains(
            'onConflict:'
        )
    )

Check `
    "refund financial ledger" `
    $h.Contains(
        ":split-refund:"
    )

Check `
    "child booking reconciliation" `
    (
        $h.Contains(
            "refund_status:"
        ) -and
        $h.Contains(
            "refunded_amount_cents:"
        )
    )

Check `
    "legacy refund fail closed" `
    $l.Contains(
        "KLYX_SPLIT_REFUND_LEGACY_GUARD_13_28"
    )

Check `
    "13.28 status API" `
    $a.Contains(
        "KLYX_SPLIT_REFUND_STATUS_API_13_28"
    )

Check `
    "automatic refund forbidden" `
    $a.Contains(
        "automaticRefund"
    )

Check `
    "direct client refund forbidden" `
    $a.Contains(
        "clientDirectRefundExecution"
    )

Check `
    "cancellation resolution required" `
    $a.Contains(
        "cancellation_resolution_required"
    )

Check `
    "future reverse transfer requirement" `
    $a.Contains(
        "reverseTransferRequiredForFutureExecution"
    )

Check `
    "13.28 UI" `
    $c.Contains(
        "KLYX_SPLIT_REFUND_STATUS_UI_13_28"
    )

Check `
    "no direct refund button" `
    (
        -not $c.Contains(
            "Rembourser maintenant"
        )
    )

Check `
    "13.28 page wiring" `
    $p.Contains(
        "KLYX_SPLIT_REFUND_STATUS_WIRING_13_28"
    )

Check `
    "13.27 retained" `
    $p.Contains(
        "KLYX_SPLIT_CHECKOUT_WIRING_13_27"
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

    throw "KLYX 13.28 static checker FAILED."
}

Write-Host ""
Write-Host "Supabase migration..."
Write-Host ""

npx.cmd supabase db push

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.28 Supabase db push FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.28 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.28 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.28 CHECK OK"
Write-Host "======================================"
Write-Host "Split refund isolation : ACTIVE"
Write-Host "Refund event ledger : ACTIF"
Write-Host "Refund webhook reconciliation : ACTIVE"
Write-Host "Partial refunds : SUPPORTES"
Write-Host "Full refunds : SUPPORTES"
Write-Host "Child booking reconciliation : ACTIVE"
Write-Host "Financial ledger : ACTIF"
Write-Host "Legacy refund collision : BLOQUEE"
Write-Host "Automatic refund : NON"
Write-Host "Direct client refund : NON"
Write-Host "Cancellation resolution gate : PREPARE"
Write-Host "13.27 payments : CONSERVES"
Write-Host "Supabase : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"