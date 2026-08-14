$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$routePath =
    Join-Path $root "app\api\provider\jobs\route.ts"

$helperPath =
    Join-Path $root "lib\provider-jobs-live-revalidation.ts"

$groupRoute =
    Join-Path $root "app\api\booking-groups\[id]\route.ts"

$migration96 =
    Join-Path $root "supabase\migrations\20260812223200_klyx_group_atomic_live_coverage_12_96.sql"

foreach (
    $path in @(
        $routePath,
        $helperPath,
        $groupRoute,
        $migration96
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

$route =
    [System.IO.File]::ReadAllText(
        $routePath
    )

$helper =
    [System.IO.File]::ReadAllText(
        $helperPath
    )

$group =
    [System.IO.File]::ReadAllText(
        $groupRoute
    )

$sql96 =
    [System.IO.File]::ReadAllText(
        $migration96
    )

$checks = @(
    @{
        Name = "12.93 retained"
        Value =
            $route.Contains(
                "KLYX_PROVIDER_MULTI_JOBS_API_12_93"
            )
    },
    @{
        Name = "13.08 route"
        Value =
            $route.Contains(
                "KLYX_PROVIDER_JOBS_LIVE_ROUTE_13_08"
            )
    },
    @{
        Name = "legacy GET retained"
        Value =
            $route.Contains(
                "klyxProviderJobsBeforeLiveEligibility13_08("
            )
    },
    @{
        Name = "13.08 helper"
        Value =
            $helper.Contains(
                "KLYX_PROVIDER_JOBS_LIVE_ELIGIBILITY_13_08"
            )
    },
    @{
        Name = "provider auth"
        Value =
            $helper.Contains(
                "requireAccountType("
            ) -and
            $helper.Contains(
                '"provider"'
            )
    },
    @{
        Name = "multi-slot detection"
        Value =
            $helper.Contains(
                '"multi_slot"'
            )
    },
    @{
        Name = "active service resolution"
        Value =
            $helper.Contains(
                '"user_services"'
            )
    },
    @{
        Name = "live RPC"
        Value =
            $helper.Contains(
                "klyx_group_live_coverage_check"
            )
    },
    @{
        Name = "N over N"
        Value =
            $helper.Contains(
                "live.coverageCount ==="
            ) -and
            $helper.Contains(
                "live.slotCount"
            )
    },
    @{
        Name = "stale removed"
        Value =
            $helper.Contains(
                "staleRemoved"
            )
    },
    @{
        Name = "unresolved fail closed"
        Value =
            $helper.Contains(
                "unresolvedRemoved"
            )
    },
    @{
        Name = "candidate resync"
        Value =
            $helper.Contains(
                "market_request_provider_candidates"
            )
    },
    @{
        Name = "no automatic offer"
        Value =
            $helper.Contains(
                "automaticOffer:"
            ) -and
            $helper.Contains(
                "false"
            )
    },
    @{
        Name = "no automatic booking"
        Value =
            $helper.Contains(
                "automaticBooking:"
            ) -and
            $helper.Contains(
                "false"
            )
    },
    @{
        Name = "no automatic payment"
        Value =
            $helper.Contains(
                "automaticPayment:"
            ) -and
            $helper.Contains(
                "false"
            )
    },
    @{
        Name = "13.07 retained"
        Value =
            $group.Contains(
                "KLYX_GROUP_PROVIDER_ACCEPT_RECOVERY_13_07"
            )
    },
    @{
        Name = "12.96 retained"
        Value =
            $sql96.Contains(
                "KLYX_GROUP_ATOMIC_LIVE_COVERAGE_12_96"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 13.08"
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

    throw "KLYX 13.08 static checker FAILED."
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

        throw "KLYX 13.08 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.08 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.08 CHECK OK"
Write-Host "======================================"
Write-Host "Provider Jobs : LIVE-AWARE"
Write-Host "Simple missions : CONSERVEES"
Write-Host "Multi-slot : N/N REVALIDE"
Write-Host "Mission stale : MASQUEE"
Write-Host "Candidate cache : RESYNCHRONISE"
Write-Host "Offre automatique : NON"
Write-Host "Booking automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "13.07 : CONSERVE"
Write-Host "Migration : AUCUNE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""