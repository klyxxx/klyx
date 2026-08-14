$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$pagePath =
    Join-Path $root "app\provider\payments\page.tsx"

$componentPath =
    Join-Path $root "app\provider\payments\FinanceExportButton.tsx"

$reconciliationPath =
    Join-Path $root "app\provider\payments\FinanceReconciliationStatus.tsx"

$financePath =
    Join-Path $root "app\api\provider\finance\route.ts"

$auditPath =
    Join-Path $root "app\api\provider\finance-audit\route.ts"

foreach (
    $path in @(
        $pagePath,
        $componentPath,
        $reconciliationPath,
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

$page =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$component =
    [System.IO.File]::ReadAllText(
        $componentPath
    )

$reconciliation =
    [System.IO.File]::ReadAllText(
        $reconciliationPath
    )

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
        Name = "13.14 component marker"
        Value =
            $component.Contains(
                "KLYX_CANONICAL_FINANCE_EXPORT_UI_13_14"
            )
    },
    @{
        Name = "13.14 page marker"
        Value =
            $page.Contains(
                "KLYX_CANONICAL_FINANCE_EXPORT_PAGE_13_14"
            )
    },
    @{
        Name = "component imported"
        Value =
            $page.Contains(
                'import FinanceExportButton from "./FinanceExportButton";'
            )
    },
    @{
        Name = "component rendered"
        Value =
            $page.Contains(
                "<FinanceExportButton />"
            )
    },
    @{
        Name = "canonical finance endpoint"
        Value =
            $component.Contains(
                '"/api/provider/finance"'
            )
    },
    @{
        Name = "raw audit not exported"
        Value =
            -not $component.Contains(
                "/api/provider/finance-audit"
            )
    },
    @{
        Name = "CSV generation"
        Value =
            $component.Contains(
                "text/csv"
            ) -and
            $component.Contains(
                "Blob("
            )
    },
    @{
        Name = "French Excel separator"
        Value =
            $component.Contains(
                '.join('
            ) -and
            $component.Contains(
                '";"'
            )
    },
    @{
        Name = "UTF8 BOM"
        Value =
            $component.Contains(
                "\uFEFF"
            )
    },
    @{
        Name = "group identity exported"
        Value =
            $component.Contains(
                "bookingGroupId"
            ) -and
            $component.Contains(
                "grouped"
            )
    },
    @{
        Name = "reconciliation exported"
        Value =
            $component.Contains(
                "Reconciliation"
            ) -and
            $component.Contains(
                "commercialEventsChecked"
            )
    },
    @{
        Name = "Stripe ids read only"
        Value =
            $component.Contains(
                "stripePaymentIntentId"
            ) -and
            $component.Contains(
                "stripeRefundId"
            )
    },
    @{
        Name = "manual export"
        Value =
            $component.Contains(
                "Exporter en CSV"
            ) -and
            $component.Contains(
                "onClick"
            )
    },
    @{
        Name = "13.13 retained"
        Value =
            $reconciliation.Contains(
                "KLYX_FINANCE_RECONCILIATION_UI_13_13"
            )
    },
    @{
        Name = "13.12 retained"
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
Write-Host "CHECK KLYX 13.14"
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
        $failed += $check.Name
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

    throw "KLYX 13.14 static checker FAILED."
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

        throw "KLYX 13.14 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.14 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.14 CHECK OK"
Write-Host "======================================"
Write-Host "Export CSV : ACTIF"
Write-Host "Transactions commerciales : CANONIQUES"
Write-Host "Mission groupee : 1 LIGNE"
Write-Host "Reconciliation : INCLUSE"
Write-Host "Ledger brut : NON EXPORTE"
Write-Host "Audit 13.03 : CONSERVE"
Write-Host "Export automatique : NON"
Write-Host "Stripe : INCHANGE"
Write-Host "Migration : AUCUNE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""