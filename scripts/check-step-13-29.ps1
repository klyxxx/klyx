$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$package =
    Join-Path `
        $root `
        "package.json"

$config =
    Join-Path `
        $root `
        "vitest.config.ts"

$economics =
    Join-Path `
        $root `
        "tests\unit\klyx-economics.test.ts"

$safety =
    Join-Path `
        $root `
        "tests\unit\payment-safety-contract.test.ts"

foreach (
    $path
    in @(
        $package,
        $config,
        $economics,
        $safety
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath `
                $path
        )
    ) {
        throw "13.29 : fichier introuvable : $path"
    }
}

$p =
    [System.IO.File]::ReadAllText(
        $package
    )

$v =
    [System.IO.File]::ReadAllText(
        $config
    )

$e =
    [System.IO.File]::ReadAllText(
        $economics
    )

$s =
    [System.IO.File]::ReadAllText(
        $safety
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
Write-Host "CHECK KLYX 13.29"
Write-Host ""

Check `
    "Vitest dependency" `
    $p.Contains(
        '"vitest"'
    )

Check `
    "npm test" `
    $p.Contains(
        '"test"'
    )

Check `
    "test:unit" `
    $p.Contains(
        '"test:unit"'
    )

Check `
    "test:watch" `
    $p.Contains(
        '"test:watch"'
    )

Check `
    "test:ci" `
    $p.Contains(
        '"test:ci"'
    )

Check `
    "Vitest config marker" `
    $v.Contains(
        "KLYX_AUTOMATED_TEST_FOUNDATION_13_29"
    )

Check `
    "backup exclusion" `
    $v.Contains(
        "scripts/backups/**"
    )

Check `
    "economics tests" `
    $e.Contains(
        "KLYX_ECONOMICS_TESTS_13_29"
    )

Check `
    "commission invariant" `
    $e.Contains(
        "platformFeeCents"
    )

Check `
    "provider amount invariant" `
    $e.Contains(
        "providerAmountCents"
    )

Check `
    "negative money rejected" `
    $e.Contains(
        "-1"
    )

Check `
    "payment safety tests" `
    $s.Contains(
        "KLYX_PAYMENT_SAFETY_CONTRACT_TESTS_13_29"
    )

Check `
    "explicit payment proof protected" `
    $s.Contains(
        "SPLIT_PAYMENT_CONFIRMATION_REQUIRED"
    )

Check `
    "Stripe idempotency protected" `
    $s.Contains(
        "idempotencyKey"
    )

Check `
    "Connect readiness protected" `
    $s.Contains(
        "stripe.accounts.retrieve"
    )

Check `
    "legacy split double-pay guard protected" `
    $s.Contains(
        "KLYX_SPLIT_LEGACY_CHECKOUT_GUARD_13_27"
    )

Check `
    "refund isolation protected" `
    $s.Contains(
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

    throw "KLYX 13.29 static checker FAILED."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.29 automated tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.29 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.29 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.29 CHECK OK"
Write-Host "======================================"
Write-Host "Vitest : ACTIF"
Write-Host "npm test : ACTIF"
Write-Host "npm run test:unit : ACTIF"
Write-Host "npm run test:ci : ACTIF"
Write-Host "Financial unit tests : ACTIFS"
Write-Host "Commission invariant : TESTE"
Write-Host "Provider amount invariant : TESTE"
Write-Host "Invalid money guards : TESTES"
Write-Host "Payment confirmation contract : TESTE"
Write-Host "Stripe idempotency contract : TESTE"
Write-Host "Connect readiness contract : TESTE"
Write-Host "Split double-pay guard : TESTE"
Write-Host "Refund isolation : TESTEE"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"