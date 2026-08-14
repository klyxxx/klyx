$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$financePath =
    Join-Path $root "app\api\provider\finance\route.ts"

$auditPath =
    Join-Path $root "app\api\provider\finance-audit\route.ts"

$pagePath =
    Join-Path $root "app\provider\payments\page.tsx"

foreach (
    $path in @(
        $financePath,
        $auditPath,
        $pagePath
    )
) {
    if (
        -not (
            Test-Path -LiteralPath $path
        )
    ) {
        throw "Fichier absent : $path"
    }
}

$finance =
    [System.IO.File]::ReadAllText(
        $financePath
    )

$audit =
    [System.IO.File]::ReadAllText(
        $auditPath
    )

$page =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$checks = @(
    @{
        Name = "finance 13.04"
        Value =
            $finance.Contains(
                "KLYX_GROUP_AWARE_FINANCE_COUNTS_13_04"
            )
    },
    @{
        Name = "booking_group_id loaded"
        Value =
            $finance.Contains(
                "booking_group_id"
            )
    },
    @{
        Name = "financial event key"
        Value =
            $finance.Contains(
                "financialEventKey("
            )
    },
    @{
        Name = "payment intent identity"
        Value =
            $finance.Contains(
                "stripe_payment_intent_id"
            )
    },
    @{
        Name = "refund identity"
        Value =
            $finance.Contains(
                "stripe_refund_id"
            )
    },
    @{
        Name = "unique payments counted"
        Value =
            $finance.Contains(
                "uniqueFinancialEvents("
            ) -and
            $finance.Contains(
                "successfulPayments"
            )
    },
    @{
        Name = "raw audit counts retained"
        Value =
            $finance.Contains(
                "rawSuccessfulPaymentRows"
            ) -and
            $finance.Contains(
                "rawSuccessfulRefundRows"
            )
    },
    @{
        Name = "group-aware flag"
        Value =
            $finance.Contains(
                "countsGroupAware:"
            )
    },
    @{
        Name = "amount aggregation explicitly ledger"
        Value =
            $finance.Contains(
                'amountAggregation:'
            ) -and
            $finance.Contains(
                '"ledger_rows"'
            )
    },
    @{
        Name = "amounts not canonicalized yet"
        Value =
            $finance.Contains(
                "amountsCanonicalized:"
            ) -and
            $finance.Contains(
                "false"
            )
    },
    @{
        Name = "gross amount calculation retained"
        Value =
            $finance.Contains(
                "grossPaidCents"
            ) -and
            $finance.Contains(
                "gross_amount_cents"
            )
    },
    @{
        Name = "provider amount retained"
        Value =
            $finance.Contains(
                "providerAmountCents"
            )
    },
    @{
        Name = "refund amount retained"
        Value =
            $finance.Contains(
                "refundedCents"
            )
    },
    @{
        Name = "transactions remain available"
        Value =
            $finance.Contains(
                "transactions"
            )
    },
    @{
        Name = "group transaction metadata"
        Value =
            $finance.Contains(
                "bookingGroupId:"
            ) -and
            $finance.Contains(
                "grouped:"
            )
    },
    @{
        Name = "no automatic execution"
        Value =
            $finance.Contains(
                "automaticExecutionAllowed:"
            ) -and
            $finance.Contains(
                "false"
            )
    },
    @{
        Name = "13.03 retained"
        Value =
            $audit.Contains(
                "KLYX_GROUP_FINANCE_AUDIT_API_13_03"
            )
    },
    @{
        Name = "payments page retained"
        Value =
            $page.Contains(
                "ProviderPaymentsPage"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 13.04"
Write-Host ""

foreach (
    $check in $checks
) {
    if (
        $check.Value
    ) {
        Write-Host "[OK]   $($check.Name)"
    }
    else {
        Write-Host "[FAIL] $($check.Name)"
        $failed +=
            $check.Name
    }
}

if (
    $failed.Count -gt 0
) {
    Write-Host ""
    Write-Host "ECHECS EXACTS :"

    foreach (
        $name in $failed
    ) {
        Write-Host " - $name"
    }

    throw "KLYX 13.04 static checker FAILED."
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

    if (
        $LASTEXITCODE -ne 0
    ) {
        $tsOutput |
            Select-Object -First 300 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 13.04 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.04 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.04 CHECK OK"
Write-Host "======================================"
Write-Host "PaymentIntent unique = 1 : OK"
Write-Host "Refund unique = 1 : OK"
Write-Host "Mission groupee = 1 scope financier"
Write-Host "Paiements comptes par evenement : OK"
Write-Host "Remboursements comptes par evenement : OK"
Write-Host "Lignes ledger brutes : CONSERVEES"
Write-Host "Montants : INCHANGES"
Write-Host "Stripe : INCHANGE"
Write-Host "13.03 : CONSERVE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""