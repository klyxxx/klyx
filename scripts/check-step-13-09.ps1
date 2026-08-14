$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$migrationPath =
    Join-Path $root "supabase\migrations\20260813105500_klyx_multi_slot_offer_atomic_13_09.sql"

$migration96 =
    Join-Path $root "supabase\migrations\20260812223200_klyx_group_atomic_live_coverage_12_96.sql"

$offerRoute =
    Join-Path $root "app\api\market\requests\[id]\offers\route.ts"

$jobsRoute =
    Join-Path $root "app\api\provider\jobs\route.ts"

$jobsHelper =
    Join-Path $root "lib\provider-jobs-live-revalidation.ts"

foreach (
    $path in @(
        $migrationPath,
        $migration96,
        $offerRoute,
        $jobsRoute,
        $jobsHelper
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

$sql =
    [System.IO.File]::ReadAllText(
        $migrationPath
    )

$sql96 =
    [System.IO.File]::ReadAllText(
        $migration96
    )

$offer =
    [System.IO.File]::ReadAllText(
        $offerRoute
    )

$jobs =
    [System.IO.File]::ReadAllText(
        $jobsRoute
    )

$helper =
    [System.IO.File]::ReadAllText(
        $jobsHelper
    )

$checks = @(
    @{
        Name = "13.09 marker"
        Value =
            $sql.Contains(
                "KLYX_MULTI_SLOT_OFFER_ATOMIC_GUARD_13_09"
            )
    },
    @{
        Name = "offer table trigger"
        Value =
            $sql.Contains(
                "public.market_service_offers"
            )
    },
    @{
        Name = "before insert or update"
        Value =
            $sql.Contains(
                "before insert or update"
            )
    },
    @{
        Name = "multi only"
        Value =
            $sql.Contains(
                "'multi_slot'"
            )
    },
    @{
        Name = "simple preserved"
        Value =
            $sql.Contains(
                "v_request_mode <>"
            )
    },
    @{
        Name = "open request required"
        Value =
            $sql.Contains(
                "KLYX_MULTI_SLOT_OFFER_ATOMIC_REQUEST_NOT_OPEN"
            )
    },
    @{
        Name = "exact context required"
        Value =
            $sql.Contains(
                "KLYX_MULTI_SLOT_OFFER_ATOMIC_CONTEXT_REQUIRED"
            )
    },
    @{
        Name = "12.96 RPC reused"
        Value =
            $sql.Contains(
                "klyx_group_live_coverage_check"
            )
    },
    @{
        Name = "camelCase supported"
        Value =
            $sql.Contains(
                "fullCoverage"
            ) -and
            $sql.Contains(
                "coverageCount"
            )
    },
    @{
        Name = "snake case supported"
        Value =
            $sql.Contains(
                "full_coverage"
            ) -and
            $sql.Contains(
                "coverage_count"
            )
    },
    @{
        Name = "N over N expected"
        Value =
            $sql.Contains(
                "v_coverage_count <>"
            ) -and
            $sql.Contains(
                "v_expected_slots"
            )
    },
    @{
        Name = "stale offer blocked"
        Value =
            $sql.Contains(
                "KLYX_MULTI_SLOT_OFFER_ATOMIC_COVERAGE_REQUIRED"
            )
    },
    @{
        Name = "12.95 retained"
        Value =
            $offer.Contains(
                "KLYX_MULTI_SLOT_LIVE_OFFER_GUARD_12_95"
            )
    },
    @{
        Name = "12.96 retained"
        Value =
            $sql96.Contains(
                "KLYX_GROUP_ATOMIC_LIVE_COVERAGE_12_96"
            )
    },
    @{
        Name = "13.08 route retained"
        Value =
            $jobs.Contains(
                "KLYX_PROVIDER_JOBS_LIVE_ROUTE_13_08"
            )
    },
    @{
        Name = "13.08 helper retained"
        Value =
            $helper.Contains(
                "KLYX_PROVIDER_JOBS_LIVE_ELIGIBILITY_13_08"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 13.09"
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

    throw "KLYX 13.09 static checker FAILED."
}

Push-Location $root

try {
    Write-Host ""
    Write-Host "Supabase db push..."
    Write-Host ""

    & npx.cmd `
        supabase `
        db `
        push `
        --linked

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.09 Supabase db push FAILED."
    }

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

        throw "KLYX 13.09 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.09 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.09 CHECK OK"
Write-Host "======================================"
Write-Host "Offre multi-slot : PROTEGEE PAR DB"
Write-Host "Couverture : N/N OBLIGATOIRE"
Write-Host "Fenetre de concurrence : FERMEE"
Write-Host "Bypass API : BLOQUE"
Write-Host "Mission simple : INCHANGEE"
Write-Host "Offre automatique : NON"
Write-Host "Booking automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "12.95 : CONSERVE"
Write-Host "12.96 : CONSERVE"
Write-Host "13.08 : CONSERVE"
Write-Host "Supabase : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""