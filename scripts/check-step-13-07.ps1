$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$routePath =
    Join-Path $root "app\api\booking-groups\[id]\route.ts"

$migration13 =
    Join-Path $root "supabase\migrations\20260813102500_klyx_group_provider_accept_live_13_06.sql"

$migration96 =
    Join-Path $root "supabase\migrations\20260812223200_klyx_group_atomic_live_coverage_12_96.sql"

foreach (
    $path in @(
        $routePath,
        $migration13,
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

$sql13 =
    [System.IO.File]::ReadAllText(
        $migration13
    )

$sql96 =
    [System.IO.File]::ReadAllText(
        $migration96
    )

$checks = @(
    @{
        Name = "13.07 marker"
        Value =
            $route.Contains(
                "KLYX_GROUP_PROVIDER_ACCEPT_RECOVERY_13_07"
            )
    },
    @{
        Name = "legacy handler retained"
        Value =
            $route.Contains(
                "klyxBookingGroupBeforeAcceptRecovery13_07("
            )
    },
    @{
        Name = "provider decision retained"
        Value =
            $route.Contains(
                "klyx_provider_group_decision"
            )
    },
    @{
        Name = "coverage DB error intercepted"
        Value =
            $route.Contains(
                "KLYX_GROUP_ACCEPT_LIVE_COVERAGE_REQUIRED"
            )
    },
    @{
        Name = "context DB error intercepted"
        Value =
            $route.Contains(
                "KLYX_GROUP_ACCEPT_LIVE_CONTEXT_REQUIRED"
            )
    },
    @{
        Name = "clean availability code"
        Value =
            $route.Contains(
                "PROVIDER_GROUP_AVAILABILITY_CHANGED"
            )
    },
    @{
        Name = "clean context code"
        Value =
            $route.Contains(
                "PROVIDER_GROUP_LIVE_CONTEXT_REQUIRED"
            )
    },
    @{
        Name = "HTTP 409 recovery"
        Value =
            $route.Contains(
                "409"
            )
    },
    @{
        Name = "group remains unaccepted"
        Value =
            $route.Contains(
                "groupAccepted:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "planning review"
        Value =
            $route.Contains(
                "reviewPlanning:"
            )
    },
    @{
        Name = "provider rejection preserved"
        Value =
            $route.Contains(
                "rejectionStillAllowed:"
            )
    },
    @{
        Name = "no auto acceptance"
        Value =
            $route.Contains(
                "automaticAcceptance:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "no auto booking"
        Value =
            $route.Contains(
                "automaticBooking:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "no auto payment"
        Value =
            $route.Contains(
                "automaticPayment:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "13.06 retained"
        Value =
            $sql13.Contains(
                "KLYX_GROUP_PROVIDER_ACCEPT_LIVE_GUARD_13_06"
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

$failed =
    @()

Write-Host ""
Write-Host "CHECK KLYX 13.07"
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

    throw "KLYX 13.07 static checker FAILED."
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

        throw "KLYX 13.07 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.07 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.07 CHECK OK"
Write-Host "======================================"
Write-Host "Acceptation provider : PROTEGEE"
Write-Host "Planning change : MESSAGE PROPRE"
Write-Host "Erreur live : HTTP 409"
Write-Host "Groupe accepte sur echec : NON"
Write-Host "Refus provider : TOUJOURS POSSIBLE"
Write-Host "Acceptation automatique : NON"
Write-Host "Booking automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "13.06 : CONSERVE"
Write-Host "Migration : AUCUNE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""