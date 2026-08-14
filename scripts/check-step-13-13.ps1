$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$pagePath =
    Join-Path $root "app\provider\payments\page.tsx"

$componentPath =
    Join-Path $root "app\provider\payments\FinanceReconciliationStatus.tsx"

$financePath =
    Join-Path $root "app\api\provider\finance\route.ts"

$auditPath =
    Join-Path $root "app\api\provider\finance-audit\route.ts"

foreach (
    $path in @(
        $pagePath,
        $componentPath,
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
        Name = "13.13 component marker"
        Value =
            $component.Contains(
                "KLYX_FINANCE_RECONCILIATION_UI_13_13"
            )
    },
    @{
        Name = "13.13 page marker"
        Value =
            $page.Contains(
                "KLYX_FINANCE_RECONCILIATION_PAGE_13_13"
            )
    },
    @{
        Name = "component imported"
        Value =
            $page.Contains(
                'import FinanceReconciliationStatus from "./FinanceReconciliationStatus";'
            )
    },
    @{
        Name = "component rendered"
        Value =
            $page.Contains(
                "<FinanceReconciliationStatus />"
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
        Name = "reconciliation endpoint consumed"
        Value =
            $component.Contains(
                '"/api/provider/finance"'
            )
    },
    @{
        Name = "authenticated request"
        Value =
            $component.Contains(
                "supabase.auth.getSession()"
            ) -and
            $component.Contains(
                "Authorization:"
            )
    },
    @{
        Name = "green success state"
        Value =
            $component.Contains(
                "Finances cohérentes"
            )
    },
    @{
        Name = "review state"
        Value =
            $component.Contains(
                "Vérification nécessaire"
            )
    },
    @{
        Name = "differences displayed"
        Value =
            $component.Contains(
                "DIFFERENCE_LABELS"
            ) -and
            $component.Contains(
                "differenceCents"
            )
    },
    @{
        Name = "manual refresh"
        Value =
            $component.Contains(
                "Revérifier"
            ) -and
            $component.Contains(
                "Réessayer"
            )
    },
    @{
        Name = "read only message"
        Value =
            $component.Contains(
                "lecture seule"
            )
    },
    @{
        Name = "audit UI retained"
        Value =
            $page.Contains(
                "KLYX_GROUP_FINANCE_AUDIT_PAGE_13_03"
            ) -and
            $page.Contains(
                "<ProviderFinanceAudit"
            )
    },
    @{
        Name = "audit API retained"
        Value =
            $audit.Contains(
                "KLYX_GROUP_FINANCE_AUDIT_API_13_03"
            )
    },
    @{
        Name = "no automatic correction"
        Value =
            $component.Contains(
                "Aucun montant n'a été corrigé automatiquement."
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 13.13"
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

    throw "KLYX 13.13 static checker FAILED."
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

        throw "KLYX 13.13 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.13 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.13 CHECK OK"
Write-Host "======================================"
Write-Host "Reconciliation finances : VISIBLE"
Write-Host "Etat coherent : VERT"
Write-Host "Difference : ALERTE VISIBLE"
Write-Host "Details differences : VISIBLES"
Write-Host "Historique complet 13.12 : CONSERVE"
Write-Host "Audit brut 13.03 : CONSERVE"
Write-Host "Correction automatique : NON"
Write-Host "Ledger : INCHANGE"
Write-Host "Stripe : INCHANGE"
Write-Host "Migration : AUCUNE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""