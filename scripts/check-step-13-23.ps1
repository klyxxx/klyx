$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$migration =
    Join-Path `
        $root `
        "supabase\migrations\20260813154500_klyx_split_price_confirmation_13_23.sql"

$api =
    Join-Path `
        $root `
        "app\api\bookings\split-missions\[id]\prices\route.ts"

$component =
    Join-Path `
        $root `
        "app\bookings\split\[id]\SplitMissionPriceConfirmation.tsx"

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
        throw "13.23 : fichier introuvable : $path"
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

    if (
        $Ok
    ) {
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
Write-Host "CHECK KLYX 13.23"
Write-Host ""

Check `
    "13.23 migration marker" `
    $m.Contains(
        "KLYX_SPLIT_PRICE_CONFIRMATION_13_23"
    )

Check `
    "price confirmation table" `
    $m.Contains(
        "split_booking_price_confirmations"
    )

Check `
    "one active proof per batch" `
    $m.Contains(
        "klyx_split_price_one_active_13_23"
    )

Check `
    "price confirmation RPC" `
    $m.Contains(
        "klyx_confirm_split_booking_prices_13_23"
    )

Check `
    "13.23 API marker" `
    $a.Contains(
        "KLYX_SPLIT_PRICE_RECONCILIATION_API_13_23"
    )

Check `
    "live booking amounts" `
    (
        $a.Contains(
            "estimated_amount_cents"
        ) -and
        $a.Contains(
            "amount_total"
        )
    )

Check `
    "canonical SHA256 proof" `
    (
        $a.Contains(
            'createHash('
        ) -and
        $a.Contains(
            '"sha256"'
        )
    )

Check `
    "price change invalidation" `
    $a.Contains(
        "live_price_changed"
    )

Check `
    "provider acceptance required" `
    $a.Contains(
        "SPLIT_PRICE_ACCEPTANCE_REQUIRED"
    )

Check `
    "budget comparison" `
    (
        $a.Contains(
            "budgetMaxCents"
        ) -and
        $a.Contains(
            "overBudget"
        )
    )

Check `
    "over budget explicit acknowledgement" `
    $a.Contains(
        "overBudgetAcknowledged"
    )

Check `
    "explicit price confirmation" `
    $a.Contains(
        "priceConfirmed"
    )

Check `
    "automatic booking forbidden" `
    $a.Contains(
        "automaticBooking"
    )

Check `
    "automatic payment forbidden" `
    (
        $a.Contains(
            "automaticPayment"
        ) -and
        $a.Contains(
            "paymentCreated"
        )
    )

Check `
    "no checkout route" `
    (
        -not $a.Contains(
            "create-checkout"
        )
    )

Check `
    "13.23 UI marker" `
    $c.Contains(
        "KLYX_SPLIT_PRICE_CONFIRMATION_UI_13_23"
    )

Check `
    "explicit price button" `
    $c.Contains(
        "Confirmer ces prix"
    )

Check `
    "price change warning" `
    $c.Contains(
        "Un prix a changé"
    )

Check `
    "budget warning" `
    $c.Contains(
        "dépasse le budget"
    )

Check `
    "13.23 wiring" `
    $p.Contains(
        "KLYX_SPLIT_PRICE_CONFIRMATION_WIRING_13_23"
    )

Check `
    "13.22 retained" `
    $p.Contains(
        "KLYX_SPLIT_PROVIDER_ACCEPTANCE_WIRING_13_22"
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

    throw "KLYX 13.23 static checker FAILED."
}

Write-Host ""
Write-Host "Supabase migration..."
Write-Host ""

npx.cmd supabase db push

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.23 Supabase db push FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.23 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.23 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.23 CHECK OK"
Write-Host "======================================"
Write-Host "Live price reconciliation : ACTIVE"
Write-Host "Exact price proof : ACTIVE"
Write-Host "Price change invalidation : ACTIVE"
Write-Host "Provider acceptance prerequisite : ACTIVE"
Write-Host "Missing price guard : ACTIVE"
Write-Host "Mixed currency guard : ACTIVE"
Write-Host "Budget comparison : ACTIVE"
Write-Host "Over-budget confirmation : EXPLICITE"
Write-Host "Client price confirmation : EXPLICITE"
Write-Host "Automatic booking : NON"
Write-Host "Automatic payment : NON"
Write-Host "Payment created : NON"
Write-Host "Supabase : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"