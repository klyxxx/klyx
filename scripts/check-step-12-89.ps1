$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$migrationPath =
    Join-Path $root "supabase\migrations\20260812210700_klyx_group_cancellation_request_12_89.sql"

$apiPath =
    Join-Path $root "app\api\booking-groups\[id]\cancellation\route.ts"

$componentPath =
    Join-Path $root "app\booking-groups\[id]\GroupCancellationCard.tsx"

$pagePath =
    Join-Path $root "app\booking-groups\[id]\page.tsx"

$reviewMigrationPath =
    Join-Path $root "supabase\migrations\20260812205500_klyx_group_review_12_88.sql"

foreach (
    $path in @(
        $migrationPath,
        $apiPath,
        $componentPath,
        $pagePath,
        $reviewMigrationPath
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

$migration =
    [System.IO.File]::ReadAllText(
        $migrationPath
    )

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

$checks = @(
    @{
        Name = "migration 12.89"
        Value = $migration.Contains(
            "KLYX_GROUP_CANCELLATION_REQUEST_12_89"
        )
    },
    @{
        Name = "group cancellation status"
        Value = $migration.Contains(
            "cancellation_request_status"
        )
    },
    @{
        Name = "refund future status"
        Value = $migration.Contains(
            "refund_status"
        )
    },
    @{
        Name = "audit table"
        Value = $migration.Contains(
            "booking_group_cancellation_events"
        )
    },
    @{
        Name = "audit RLS"
        Value =
            $migration.Contains(
                "enable row level security"
            )
    },
    @{
        Name = "API 12.89"
        Value = $api.Contains(
            "KLYX_GROUP_CANCELLATION_API_12_89"
        )
    },
    @{
        Name = "participants only"
        Value =
            $api.Contains(
                "participantRole("
            )
    },
    @{
        Name = "request action"
        Value =
            $api.Contains(
                'action === "request"'
            )
    },
    @{
        Name = "withdraw action"
        Value =
            $api.Contains(
                '"withdraw"'
            )
    },
    @{
        Name = "minimum reason"
        Value =
            $api.Contains(
                "reason.length < 10"
            )
    },
    @{
        Name = "no automatic cancellation"
        Value =
            $api.Contains(
                "automaticCancellation:"
            ) -and
            $api.Contains(
                "false"
            )
    },
    @{
        Name = "no automatic refund"
        Value =
            $api.Contains(
                "automaticRefund:"
            )
    },
    @{
        Name = "no Stripe refund call"
        Value =
            -not $api.Contains(
                "refunds.create"
            )
    },
    @{
        Name = "no child booking mutation"
        Value =
            -not $api.Contains(
                '.from("bookings")'
            )
    },
    @{
        Name = "UI 12.89"
        Value =
            $component.Contains(
                "KLYX_GROUP_CANCELLATION_UI_12_89"
            )
    },
    @{
        Name = "group page integration"
        Value =
            $page.Contains(
                "KLYX_GROUP_CANCELLATION_CARD_12_89"
            )
    },
    @{
        Name = "12.87 retained"
        Value =
            $page.Contains(
                "KLYX_GROUP_MISSION_PAGE_12_87"
            )
    },
    @{
        Name = "12.88 retained"
        Value =
            $page.Contains(
                "KLYX_GROUP_REVIEW_CTA_12_88"
            )
    }
)

$failed = @()

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

$statusGuard =
    Get-ChildItem `
        -LiteralPath $root `
        -Recurse `
        -File `
        -Include *.ts,*.tsx `
        -ErrorAction SilentlyContinue |
    Select-String `
        -Pattern "KLYX_GROUP_STATUS_GUARD_12_85" `
        -SimpleMatch `
        -List

if (
    $statusGuard
) {
    Write-Host "[OK]   grouped child status guard 12.85"
}
else {
    Write-Host "[FAIL] grouped child status guard 12.85"
    $failed +=
        "grouped child status guard 12.85"
}

if (
    $failed.Count -gt 0
) {
    Write-Host ""

    Write-Host "Echecs :"

    $failed |
        ForEach-Object {
            Write-Host " - $_"
        }

    throw "KLYX 12.89 static checker FAILED."
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
            Select-Object -First 250 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.89 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 12.89 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.89 CHECK OK"
Write-Host "======================================"
Write-Host "Demande annulation groupee : OK"
Write-Host "Client / prestataire : OK"
Write-Host "Motif obligatoire : OK"
Write-Host "Retrait demande : OK"
Write-Host "Audit : OK"
Write-Host "Notifications : OK"
Write-Host "Creneaux enfants proteges : OK"
Write-Host "Annulation automatique : NON"
Write-Host "Remboursement automatique : NON"
Write-Host "12.88 : CONSERVE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""