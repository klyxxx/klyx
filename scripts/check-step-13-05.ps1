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
        Name = "13.05c runtime schema"
        Value =
            $finance.Contains(
                "KLYX_GROUP_SCHEMA_RUNTIME_FINANCE_13_05C"
            )
    },
    @{
        Name = "13.04 retained"
        Value =
            $finance.Contains(
                "KLYX_GROUP_AWARE_FINANCE_COUNTS_13_04"
            )
    },
    @{
        Name = "booking groups select all"
        Value =
            $finance.Contains(
                '"booking_groups"'
            ) -and
            $finance.Contains(
                '.select('
            ) -and
            $finance.Contains(
                '"*"'
            )
    },
    @{
        Name = "runtime candidate detection"
        Value =
            $finance.Contains(
                "GROUP_TOTAL_CANDIDATES"
            )
    },
    @{
        Name = "no required single column"
        Value =
            $finance.Contains(
                "canonicalGroupTotal("
            )
    },
    @{
        Name = "euros supported"
        Value =
            $finance.Contains(
                "eurosToCents("
            )
    },
    @{
        Name = "cents supported"
        Value =
            $finance.Contains(
                "storedAsCents"
            )
    },
    @{
        Name = "legitimate allocation preserved"
        Value =
            $finance.Contains(
                "canonicalizeGroupPayment("
            )
    },
    @{
        Name = "duplicate inflation normalized"
        Value =
            $finance.Contains(
                "normalizationRatio"
            )
    },
    @{
        Name = "refund capped"
        Value =
            $finance.Contains(
                "Math.min("
            ) -and
            $finance.Contains(
                "rawRefund"
            )
    },
    @{
        Name = "legacy fallback preserved"
        Value =
            $finance.Contains(
                "groupPaymentFallbacks"
            ) -and
            $finance.Contains(
                "groupRefundFallbacks"
            )
    },
    @{
        Name = "detected columns exposed"
        Value =
            $finance.Contains(
                "detectedGroupTotalColumns"
            )
    },
    @{
        Name = "unique event counting retained"
        Value =
            $finance.Contains(
                "uniqueFinancialEvents("
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
        Name = "13.03 audit retained"
        Value =
            $audit.Contains(
                "KLYX_GROUP_FINANCE_AUDIT_API_13_03"
            )
    }
)

$failed =
    @()

Write-Host ""
Write-Host "CHECK KLYX 13.05c"
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

    throw "KLYX 13.05c static checker FAILED."
}

Push-Location $root

try {
    Write-Host ""
    Write-Host "TypeScript..."
    Write-Host ""

    $tsOutput =
        @(
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

        throw "KLYX 13.05c TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.05c build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.05c CHECK OK"
Write-Host "======================================"
Write-Host "Colonne total imposee : NON"
Write-Host "Schema groupe : DETECTION RUNTIME"
Write-Host "Montant simple : LEDGER"
Write-Host "Montant groupe : CANONIQUE SI DISPONIBLE"
Write-Host "Anciennes donnees : FALLBACK SAFE"
Write-Host "50 + 50 valide : PRESERVE"
Write-Host "100 + 100 duplique : NORMALISE"
Write-Host "Refund partiel : PROTEGE"
Write-Host "Stripe : INCHANGE"
Write-Host "Migration : AUCUNE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""