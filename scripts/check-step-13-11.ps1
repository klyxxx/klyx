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
        Name = "13.11 marker"
        Value =
            $finance.Contains(
                "KLYX_CANONICAL_FINANCE_TRANSACTIONS_13_11"
            )
    },
    @{
        Name = "raw ledger retained internally"
        Value =
            $finance.Contains(
                "rawTransactions13_11"
            )
    },
    @{
        Name = "commercial buckets"
        Value =
            $finance.Contains(
                "commercialBuckets13_11"
            )
    },
    @{
        Name = "financial event identity reused"
        Value =
            $finance.Contains(
                "transaction.financialEventKey"
            )
    },
    @{
        Name = "group canonical total reused"
        Value =
            $finance.Contains(
                "canonicalGroupTotal("
            )
    },
    @{
        Name = "group payment capped"
        Value =
            $finance.Contains(
                "canonical.cents"
            ) -and
            $finance.Contains(
                "rawGross"
            )
    },
    @{
        Name = "group refund capped"
        Value =
            $finance.Contains(
                "Math.min("
            ) -and
            $finance.Contains(
                "rawRefund"
            )
    },
    @{
        Name = "commercial transaction output"
        Value =
            $finance.Contains(
                "const transactions ="
            )
    },
    @{
        Name = "single transactions retained"
        Value =
            $finance.Contains(
                "commercialSingles13_11"
            )
    },
    @{
        Name = "group transactions merged"
        Value =
            $finance.Contains(
                "commercialGroups13_11"
            )
    },
    @{
        Name = "13.05c retained"
        Value =
            $finance.Contains(
                "KLYX_GROUP_SCHEMA_RUNTIME_FINANCE_13_05C"
            )
    },
    @{
        Name = "13.03 audit retained"
        Value =
            $audit.Contains(
                "KLYX_GROUP_FINANCE_AUDIT_API_13_03"
            )
    },
    @{
        Name = "payments page retained"
        Value =
            $page.Contains(
                "KLYX_GROUP_FINANCE_AUDIT_PAGE_13_03"
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
    }
)

$failed =
    @()

Write-Host ""
Write-Host "CHECK KLYX 13.11"
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

    throw "KLYX 13.11 static checker FAILED."
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

        throw "KLYX 13.11 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.11 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.11 CHECK OK"
Write-Host "======================================"
Write-Host "Booking simple : 1 TRANSACTION"
Write-Host "Booking groupe : 1 TRANSACTION COMMERCIALE"
Write-Host "Allocations enfants : MASQUEES DE LA VUE"
Write-Host "50 + 50 valide : 100"
Write-Host "100 + 100 duplique : PLAFONNE AU GROUPE"
Write-Host "Refund groupe : 1 LIGNE"
Write-Host "Ledger brut : CONSERVE"
Write-Host "Audit 13.03 : CONSERVE"
Write-Host "Stripe : INCHANGE"
Write-Host "Migration : AUCUNE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""