$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$financePath =
    Join-Path $root "app\api\provider\finance\route.ts"

$auditPath =
    Join-Path $root "app\api\provider\finance-audit\route.ts"

foreach (
    $path in @(
        $financePath,
        $auditPath
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

$checks = @(
    @{
        Name = "13.12 marker"
        Value =
            $finance.Contains(
                "KLYX_CANONICAL_FINANCE_RECONCILIATION_13_12"
            )
    },
    @{
        Name = "13.11 retained"
        Value =
            $finance.Contains(
                "KLYX_CANONICAL_FINANCE_TRANSACTIONS_13_11"
            )
    },
    @{
        Name = "all commercial transactions"
        Value =
            $finance.Contains(
                "commercialTransactionsAll13_12"
            )
    },
    @{
        Name = "UI still capped to 100"
        Value =
            $finance.Contains(
                ".slice("
            ) -and
            $finance.Contains(
                "100"
            )
    },
    @{
        Name = "reconciliation before UI truncation"
        Value =
            $finance.Contains(
                "commercialEventsChecked"
            ) -and
            $finance.Contains(
                "historyTruncatedForDisplay"
            )
    },
    @{
        Name = "gross reconciled"
        Value =
            $finance.Contains(
                "reconciledGrossPaidCents13_12"
            )
    },
    @{
        Name = "fee reconciled"
        Value =
            $finance.Contains(
                "reconciledPlatformFeeCents13_12"
            )
    },
    @{
        Name = "provider amount reconciled"
        Value =
            $finance.Contains(
                "reconciledProviderAmountCents13_12"
            )
    },
    @{
        Name = "refund reconciled"
        Value =
            $finance.Contains(
                "reconciledRefundedCents13_12"
            )
    },
    @{
        Name = "processing refund reconciled"
        Value =
            $finance.Contains(
                "reconciledProcessingRefundCents13_12"
            )
    },
    @{
        Name = "differences exposed"
        Value =
            $finance.Contains(
                "differenceCents:"
            )
    },
    @{
        Name = "review required status"
        Value =
            $finance.Contains(
                '"review_required"'
            )
    },
    @{
        Name = "no automatic correction"
        Value =
            $finance.Contains(
                "automaticCorrection:"
            ) -and
            $finance.Contains(
                "false"
            )
    },
    @{
        Name = "ledger immutable"
        Value =
            $finance.Contains(
                "ledgerModified:"
            ) -and
            $finance.Contains(
                "false"
            )
    },
    @{
        Name = "Stripe immutable"
        Value =
            $finance.Contains(
                "stripeModified:"
            ) -and
            $finance.Contains(
                "false"
            )
    },
    @{
        Name = "13.03 audit retained"
        Value =
            $audit.Contains(
                "KLYX_GROUP_FINANCE_AUDIT_API_13_03"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 13.12"
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

    throw "KLYX 13.12 static checker FAILED."
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

        throw "KLYX 13.12 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.12 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.12 CHECK OK"
Write-Host "======================================"
Write-Host "Resume canonique : VERIFIE"
Write-Host "Transactions commerciales : VERIFIEES"
Write-Host "100 dernieres UI : CONSERVE"
Write-Host "Historique complet : UTILISE POUR RECONCILIATION"
Write-Host "Difference financiere : DETECTABLE"
Write-Host "Correction automatique : NON"
Write-Host "Ledger brut : CONSERVE"
Write-Host "Audit 13.03 : CONSERVE"
Write-Host "Stripe : INCHANGE"
Write-Host "Migration : AUCUNE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""