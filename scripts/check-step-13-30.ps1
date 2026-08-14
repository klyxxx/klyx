$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$config =
    Join-Path `
        $root `
        "vitest.config.mts"

$integration =
    Join-Path `
        $root `
        "tests\integration\split-checkout-security.test.ts"

$contracts =
    Join-Path `
        $root `
        "tests\integration\booking-role-contracts.test.ts"

foreach (
    $path
    in @(
        $config,
        $integration,
        $contracts
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath `
                $path
        )
    ) {
        throw "13.30 : fichier introuvable : $path"
    }
}

$v =
    [System.IO.File]::ReadAllText(
        $config
    )

$i =
    [System.IO.File]::ReadAllText(
        $integration
    )

$c =
    [System.IO.File]::ReadAllText(
        $contracts
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
Write-Host "CHECK KLYX 13.30"
Write-Host ""

Check `
    "ESM Vitest config" `
    $v.Contains(
        "KLYX_TEST_INTEGRATION_FOUNDATION_13_30"
    )

Check `
    "KLYX alias available in tests" `
    $v.Contains(
        'alias:'
    )

Check `
    "mocked Supabase integration" `
    (
        $i.Contains(
            "supabaseAdmin"
        ) -and
        $i.Contains(
            "vi.mock"
        )
    )

Check `
    "mocked Stripe integration" `
    (
        $i.Contains(
            '"stripe"'
        ) -and
        $i.Contains(
            "stripeCheckoutCreate"
        )
    )

Check `
    "real split route imported" `
    $i.Contains(
        'split-missions/[id]/checkout/route'
    )

Check `
    "explicit confirmation test" `
    $i.Contains(
        "SPLIT_CHECKOUT_PREPARATION_CONFIRMATION_REQUIRED"
    )

Check `
    "wrong-role test" `
    (
        $i.Contains(
            "provider-profile"
        ) -and
        $i.Contains(
            '"client"'
        )
    )

Check `
    "no Stripe call before authorization" `
    $i.Contains(
        "not.toHaveBeenCalled"
    )

Check `
    "booking role contract suite" `
    $c.Contains(
        "KLYX_BOOKING_ROLE_CONTRACTS_13_30"
    )

Check `
    "double-payment contract" `
    $c.Contains(
        "SPLIT_CHILD_ALREADY_HAS_PAYMENT"
    )

Check `
    "legacy atomic payment claim protected" `
    $c.Contains(
        "klyx_claim_booking_payment"
    )

Check `
    "webhook idempotence protected" `
    $c.Contains(
        "claimStripeWebhookEvent"
    )

Check `
    "refund isolation protected" `
    $c.Contains(
        "KLYX_SPLIT_REFUND_LEGACY_GUARD_13_28"
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

    throw "KLYX 13.30 static checker FAILED."
}

Write-Host ""
Write-Host "Integration tests..."
Write-Host ""

npm.cmd test -- --reporter=verbose

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.30 integration tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.30 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.30 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.30 CHECK OK"
Write-Host "======================================"
Write-Host "Vitest ESM config : ACTIVE"
Write-Host "Supabase mock : ACTIF"
Write-Host "Stripe mock : ACTIF"
Write-Host "Real API route test : ACTIF"
Write-Host "Client-role gate : TESTE"
Write-Host "Explicit payment gate : TESTE"
Write-Host "Unauthorized Stripe call : BLOQUEE/TESTEE"
Write-Host "Live price contract : TESTE"
Write-Host "Provider acceptance contract : TESTE"
Write-Host "Duplicate payment contract : TESTE"
Write-Host "Legacy payment lock : TESTE"
Write-Host "Webhook idempotence : TESTEE"
Write-Host "Refund isolation : TESTEE"
Write-Host "Real Stripe transaction : NON"
Write-Host "Real Supabase mutation : NON"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"