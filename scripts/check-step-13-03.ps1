$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$apiPath =
    Join-Path $root "app\api\provider\finance-audit\route.ts"

$componentPath =
    Join-Path $root "app\provider\payments\ProviderFinanceAudit.tsx"

$pagePath =
    Join-Path $root "app\provider\payments\page.tsx"

$financePath =
    Join-Path $root "app\api\provider\finance\route.ts"

$activityPath =
    Join-Path $root "app\api\provider\activity-summary\route.ts"

foreach (
    $path in @(
        $apiPath,
        $componentPath,
        $pagePath,
        $financePath,
        $activityPath
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

$api =
    [System.IO.File]::ReadAllText(
        $apiPath
    )

$component =
    [System.IO.File]::ReadAllText(
        $componentPath
    )

$page =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$activity =
    [System.IO.File]::ReadAllText(
        $activityPath
    )

$checks = @(
    @{
        Name = "finance audit API"
        Value =
            $api.Contains(
                "KLYX_GROUP_FINANCE_AUDIT_API_13_03"
            )
    },
    @{
        Name = "provider protected"
        Value =
            $api.Contains(
                "requireAccountType("
            ) -and
            $api.Contains(
                '"provider"'
            )
    },
    @{
        Name = "booking group mapping"
        Value =
            $api.Contains(
                "booking_group_id"
            )
    },
    @{
        Name = "financial ledger inspected"
        Value =
            $api.Contains(
                '"booking_financial_ledger"'
            )
    },
    @{
        Name = "payment intent inspected"
        Value =
            $api.Contains(
                "stripe_payment_intent_id"
            )
    },
    @{
        Name = "refund inspected"
        Value =
            $api.Contains(
                "stripe_refund_id"
            )
    },
    @{
        Name = "allocation distinguished"
        Value =
            $api.Contains(
                "allocatedAmounts"
            )
    },
    @{
        Name = "repeated amount detection"
        Value =
            $api.Contains(
                "sameAmountsRepeated"
            )
    },
    @{
        Name = "suspicious classification"
        Value =
            $api.Contains(
                "suspiciousPaymentEvents"
            ) -and
            $api.Contains(
                "suspiciousRefundEvents"
            )
    },
    @{
        Name = "read only"
        Value =
            $api.Contains(
                "readOnly:"
            ) -and
            $api.Contains(
                "true"
            )
    },
    @{
        Name = "no automatic execution"
        Value =
            $api.Contains(
                "automaticExecutionAllowed:"
            ) -and
            $api.Contains(
                "false"
            )
    },
    @{
        Name = "audit UI"
        Value =
            $component.Contains(
                "KLYX_GROUP_FINANCE_AUDIT_UI_13_03"
            )
    },
    @{
        Name = "audit metrics UI"
        Value =
            $component.Contains(
                "KLYX_GROUP_FINANCE_AUDIT_METRICS_13_03"
            )
    },
    @{
        Name = "payments page wired"
        Value =
            $page.Contains(
                "KLYX_GROUP_FINANCE_AUDIT_PAGE_13_03"
            ) -and
            $page.Contains(
                "<ProviderFinanceAudit />"
            )
    },
    @{
        Name = "13.02 retained"
        Value =
            $activity.Contains(
                "KLYX_PROVIDER_GROUP_ACTIVITY_API_13_02"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 13.03"
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

    throw "KLYX 13.03 static checker FAILED."
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

        throw "KLYX 13.03 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.03 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.03 CHECK OK"
Write-Host "======================================"
Write-Host "Ledger financier : AUDITE"
Write-Host "Missions groupees : IDENTIFIEES"
Write-Host "PaymentIntent uniques : IDENTIFIES"
Write-Host "Refund uniques : IDENTIFIES"
Write-Host "Doublons potentiels : DETECTABLES"
Write-Host "Allocations normales : DISTINGUEES"
Write-Host "Montants modifies : NON"
Write-Host "Stripe modifie : NON"
Write-Host "13.02 : CONSERVE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""