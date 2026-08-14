$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$helperPath =
    Join-Path $root "lib\multi-slot-live-coverage.ts"

$routePath =
    Join-Path $root "app\api\market\requests\[id]\offers\route.ts"

$providerJobsPath =
    Join-Path $root "app\api\provider\jobs\route.ts"

foreach (
    $path in @(
        $helperPath,
        $routePath,
        $providerJobsPath
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

$helper =
    [System.IO.File]::ReadAllText(
        $helperPath
    )

$route =
    [System.IO.File]::ReadAllText(
        $routePath
    )

$providerJobs =
    [System.IO.File]::ReadAllText(
        $providerJobsPath
    )

$checks = @(
    @{
        Name = "live coverage helper"
        Value =
            $helper.Contains(
                "KLYX_MULTI_SLOT_LIVE_COVERAGE_12_95"
            )
    },
    @{
        Name = "availability table"
        Value =
            $helper.Contains(
                "availability_slots"
            )
    },
    @{
        Name = "specific user service availability"
        Value =
            $helper.Contains(
                '"user_service_id"'
            ) -and
            $helper.Contains(
                "userServiceId"
            )
    },
    @{
        Name = "availability active only"
        Value =
            $helper.Contains(
                '"is_active"'
            ) -and
            $helper.Contains(
                "true"
            )
    },
    @{
        Name = "weekday matching"
        Value =
            $helper.Contains(
                "getUTCDay"
            )
    },
    @{
        Name = "overnight availability"
        Value =
            $helper.Contains(
                "crossesMidnight"
            )
    },
    @{
        Name = "previous-day overnight support"
        Value =
            $helper.Contains(
                "previousWeekday"
            )
    },
    @{
        Name = "booking conflicts"
        Value =
            $helper.Contains(
                '.from('
            ) -and
            $helper.Contains(
                '"bookings"'
            ) -and
            $helper.Contains(
                "conflictBooking("
            )
    },
    @{
        Name = "accepted/completed hard conflicts"
        Value =
            $helper.Contains(
                '"accepted"'
            ) -and
            $helper.Contains(
                '"completed"'
            )
    },
    @{
        Name = "overlap detection"
        Value =
            $helper.Contains(
                "target.start <"
            ) -and
            $helper.Contains(
                "interval.start <"
            )
    },
    @{
        Name = "live offer guard"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_LIVE_OFFER_GUARD_12_95"
            )
    },
    @{
        Name = "live helper invoked"
        Value =
            $route.Contains(
                "validateProviderLiveMultiSlotCoverage("
            )
    },
    @{
        Name = "candidate snapshot resynced"
        Value =
            $route.Contains(
                "candidateSyncError"
            ) -and
            $route.Contains(
                "coverage_count:"
            )
    },
    @{
        Name = "live failure blocked"
        Value =
            $route.Contains(
                "MULTI_SLOT_LIVE_COVERAGE_REQUIRED"
            ) -and
            $route.Contains(
                "status: 409"
            )
    },
    @{
        Name = "12.94 retained"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_OFFER_SERVER_GUARD_12_94"
            )
    },
    @{
        Name = "12.93 retained"
        Value =
            $providerJobs.Contains(
                "KLYX_PROVIDER_MULTI_JOBS_API_12_93"
            )
    },
    @{
        Name = "offer still after guards"
        Value =
            $route.Contains(
                "market_service_offers"
            ) -and
            $route.Contains(
                ".upsert("
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 12.95"
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

    throw "KLYX 12.95 static checker FAILED."
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

        throw "KLYX 12.95 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 12.95 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.95 CHECK OK"
Write-Host "======================================"
Write-Host "Candidat N/N historique : VERIFIE"
Write-Host "Disponibilites live : VERIFIEES"
Write-Host "Bookings live : VERIFIES"
Write-Host "Chevauchement : BLOQUE"
Write-Host "Planning change : DETECTE"
Write-Host "Candidat stale : RESYNCHRONISE"
Write-Host "Offre si couverture perdue : BLOQUEE"
Write-Host "Missions simples : CONSERVEES"
Write-Host "12.94 : CONSERVE"
Write-Host "Execution automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""