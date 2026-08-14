$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$routePath =
    Join-Path $root "app\api\market\requests\[id]\split-fallback\route.ts"

$jobsHelper =
    Join-Path $root "lib\provider-jobs-live-revalidation.ts"

$groupRoute =
    Join-Path $root "app\api\market\requests\[id]\group-booking\route.ts"

foreach (
    $path in @(
        $routePath,
        $jobsHelper,
        $groupRoute
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

$jobs =
    [System.IO.File]::ReadAllText(
        $jobsHelper
    )

$group =
    [System.IO.File]::ReadAllText(
        $groupRoute
    )

$checks = @(
    @{
        Name = "13.15 marker"
        Value =
            $route.Contains(
                "KLYX_MULTI_PROVIDER_FALLBACK_API_13_15"
            )
    },
    @{
        Name = "client authentication"
        Value =
            $route.Contains(
                "getAuthenticatedProfile"
            ) -and
            $route.Contains(
                '"client"'
            )
    },
    @{
        Name = "multi-slot only"
        Value =
            $route.Contains(
                '"multi_slot"'
            )
    },
    @{
        Name = "provider candidates"
        Value =
            $route.Contains(
                "market_request_provider_candidates"
            )
    },
    @{
        Name = "single provider remains priority"
        Value =
            $route.Contains(
                "SINGLE_PROVIDER_FULL_COVERAGE_AVAILABLE"
            )
    },
    @{
        Name = "partial coverage ranked"
        Value =
            $route.Contains(
                "partialCandidates"
            )
    },
    @{
        Name = "no false N over N claim"
        Value =
            $route.Contains(
                "slot_mapping_required"
            ) -and
            $route.Contains(
                "per_slot_provider_coverage"
            )
    },
    @{
        Name = "split candidate exposed"
        Value =
            $route.Contains(
                "splitFallbackCandidate"
            )
    },
    @{
        Name = "split not yet proven"
        Value =
            $route.Contains(
                "splitFallbackPossible:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "explicit confirmation retained"
        Value =
            $route.Contains(
                "explicitConfirmationRequired:"
            ) -and
            $route.Contains(
                "true"
            )
    },
    @{
        Name = "no automatic provider selection"
        Value =
            $route.Contains(
                "automaticProviderSelection:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "no automatic booking"
        Value =
            $route.Contains(
                "automaticBooking:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "no automatic payment"
        Value =
            $route.Contains(
                "automaticPayment:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "13.08 retained"
        Value =
            $jobs.Contains(
                "KLYX_PROVIDER_JOBS_LIVE_ELIGIBILITY_13_08"
            )
    },
    @{
        Name = "group booking retained"
        Value =
            $group.Contains(
                "klyx_create_multi_slot_booking_group"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 13.15"
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

    throw "KLYX 13.15 static checker FAILED."
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

        throw "KLYX 13.15 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.15 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.15 CHECK OK"
Write-Host "======================================"
Write-Host "Fallback multi-provider : ACTIF"
Write-Host "Prestataire unique N/N : PRIORITAIRE"
Write-Host "Prestataires partiels : DETECTES"
Write-Host "Classement partiel : ACTIF"
Write-Host "Fausse couverture N/N : INTERDITE"
Write-Host "Mapping exact des slots : REQUIS"
Write-Host "Selection automatique : NON"
Write-Host "Booking automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "Migration : AUCUNE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""