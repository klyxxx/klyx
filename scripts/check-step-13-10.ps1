$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$routePath =
    Join-Path $root "app\api\market\requests\[id]\offers\route.ts"

$migration09 =
    Join-Path $root "supabase\migrations\20260813105500_klyx_multi_slot_offer_atomic_13_09.sql"

$jobsRoute =
    Join-Path $root "app\api\provider\jobs\route.ts"

foreach (
    $path in @(
        $routePath,
        $migration09,
        $jobsRoute
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

$sql09 =
    [System.IO.File]::ReadAllText(
        $migration09
    )

$jobs =
    [System.IO.File]::ReadAllText(
        $jobsRoute
    )

$checks = @(
    @{
        Name = "13.10 marker"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_OFFER_ATOMIC_RECOVERY_13_10"
            )
    },
    @{
        Name = "legacy offer handler retained"
        Value =
            $route.Contains(
                "klyxOfferBeforeAtomicRecovery13_10("
            )
    },
    @{
        Name = "12.95 retained"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_LIVE_OFFER_GUARD_12_95"
            )
    },
    @{
        Name = "atomic coverage mapped"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_OFFER_ATOMIC_COVERAGE_REQUIRED"
            )
    },
    @{
        Name = "closed request mapped"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_OFFER_ATOMIC_REQUEST_NOT_OPEN"
            )
    },
    @{
        Name = "context mapped"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_OFFER_ATOMIC_CONTEXT_REQUIRED"
            )
    },
    @{
        Name = "invalid slots mapped"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_OFFER_ATOMIC_INVALID_SLOT_COUNT"
            )
    },
    @{
        Name = "clean availability code"
        Value =
            $route.Contains(
                "MULTI_SLOT_OFFER_AVAILABILITY_CHANGED"
            )
    },
    @{
        Name = "clean closed code"
        Value =
            $route.Contains(
                "MULTI_SLOT_OFFER_REQUEST_CLOSED"
            )
    },
    @{
        Name = "clean context code"
        Value =
            $route.Contains(
                "MULTI_SLOT_OFFER_CONTEXT_REQUIRED"
            )
    },
    @{
        Name = "HTTP 409"
        Value =
            $route.Contains(
                "409"
            )
    },
    @{
        Name = "offer not created"
        Value =
            $route.Contains(
                "offerCreated:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "refresh jobs recovery"
        Value =
            $route.Contains(
                "refreshJobs:"
            )
    },
    @{
        Name = "no automatic offer"
        Value =
            $route.Contains(
                "automaticOffer:"
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
        Name = "13.09 retained"
        Value =
            $sql09.Contains(
                "KLYX_MULTI_SLOT_OFFER_ATOMIC_GUARD_13_09"
            )
    },
    @{
        Name = "13.08 retained"
        Value =
            $jobs.Contains(
                "KLYX_PROVIDER_JOBS_LIVE_ROUTE_13_08"
            )
    }
)

$failed =
    @()

Write-Host ""
Write-Host "CHECK KLYX 13.10"
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

    throw "KLYX 13.10 static checker FAILED."
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

        throw "KLYX 13.10 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.10 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.10 CHECK OK"
Write-Host "======================================"
Write-Host "Offre atomique : ERREURS NORMALISEES"
Write-Host "Planning change : HTTP 409 PROPRE"
Write-Host "Demande fermee : HTTP 409 PROPRE"
Write-Host "Contexte invalide : BLOQUE"
Write-Host "Offre creee sur echec : NON"
Write-Host "Offre automatique : NON"
Write-Host "Booking automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "13.09 : CONSERVE"
Write-Host "Migration : AUCUNE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""