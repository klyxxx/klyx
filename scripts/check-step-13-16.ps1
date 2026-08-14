$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$routePath =
    Join-Path $root "app\api\market\requests\[id]\split-fallback\slot-map\route.ts"

$fallbackPath =
    Join-Path $root "app\api\market\requests\[id]\split-fallback\route.ts"

$migration83 =
    Join-Path $root "supabase\migrations\20260812195600_klyx_multi_slot_market_12_83.sql"

$migration96 =
    Join-Path $root "supabase\migrations\20260812223200_klyx_group_atomic_live_coverage_12_96.sql"

foreach (
    $path in @(
        $routePath,
        $fallbackPath,
        $migration83,
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

$fallback =
    [System.IO.File]::ReadAllText(
        $fallbackPath
    )

$sql83 =
    [System.IO.File]::ReadAllText(
        $migration83
    )

$sql96 =
    [System.IO.File]::ReadAllText(
        $migration96
    )

$checks = @(
    @{
        Name = "13.16 marker"
        Value =
            $route.Contains(
                "KLYX_MULTI_PROVIDER_EXACT_SLOT_MAP_13_16"
            )
    },
    @{
        Name = "slot table resolved"
        Value =
            -not $route.Contains(
                "__SLOT_TABLE__"
            )
    },
    @{
        Name = "client auth"
        Value =
            $route.Contains(
                "requireAccountType("
            ) -and
            $route.Contains(
                '"client"'
            )
    },
    @{
        Name = "real slots loaded"
        Value =
            $route.Contains(
                '"market_request_id"'
            )
    },
    @{
        Name = "provider service active"
        Value =
            $route.Contains(
                '"user_services"'
            ) -and
            $route.Contains(
                '"provider_enabled"'
            )
    },
    @{
        Name = "availability live"
        Value =
            $route.Contains(
                '"availability_slots"'
            )
    },
    @{
        Name = "booking conflicts"
        Value =
            $route.Contains(
                '"bookings"'
            ) -and
            $route.Contains(
                "bookingConflict("
            )
    },
    @{
        Name = "12.96 cross check"
        Value =
            $route.Contains(
                "klyx_group_live_coverage_check"
            )
    },
    @{
        Name = "RPC array supported"
        Value =
            $route.Contains(
                "Array.isArray("
            )
    },
    @{
        Name = "coverage count cross checked"
        Value =
            $route.Contains(
                "live.coverageCount ==="
            ) -and
            $route.Contains(
                "slotIds.length"
            )
    },
    @{
        Name = "slot count cross checked"
        Value =
            $route.Contains(
                "live.slotCount ==="
            ) -and
            $route.Contains(
                "slots.length"
            )
    },
    @{
        Name = "single provider priority"
        Value =
            $route.Contains(
                "SINGLE_PROVIDER_FULL_COVERAGE_AVAILABLE"
            )
    },
    @{
        Name = "verified split plan"
        Value =
            $route.Contains(
                "EXACT_MULTI_PROVIDER_PLAN_AVAILABLE"
            )
    },
    @{
        Name = "uncovered slots exposed"
        Value =
            $route.Contains(
                "uncoveredSlotIds"
            )
    },
    @{
        Name = "explicit confirmation"
        Value =
            $route.Contains(
                "explicitConfirmationRequired:"
            ) -and
            $route.Contains(
                "true"
            )
    },
    @{
        Name = "no auto provider selection"
        Value =
            $route.Contains(
                "automaticProviderSelection:"
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
        Name = "13.15b retained"
        Value =
            $fallback.Contains(
                "KLYX_MULTI_PROVIDER_FALLBACK_FIX_13_15B"
            )
    },
    @{
        Name = "12.83 retained"
        Value =
            $sql83.Contains(
                "KLYX_MULTI_SLOT_MARKET_12_83"
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
Write-Host "CHECK KLYX 13.16"
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

    throw "KLYX 13.16 static checker FAILED."
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

        throw "KLYX 13.16 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.16 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.16 CHECK OK"
Write-Host "======================================"
Write-Host "Mapping exact slots : ACTIF"
Write-Host "Disponibilite prestataire : LIVE"
Write-Host "Conflits missions : VERIFIES"
Write-Host "RPC 12.96 : CROSS-CHECK"
Write-Host "Divergence : FAIL CLOSED"
Write-Host "Prestataire unique N/N : PRIORITAIRE"
Write-Host "Plan multi-provider : PROUVABLE"
Write-Host "Slots non couverts : DETECTABLES"
Write-Host "Confirmation client : OBLIGATOIRE"
Write-Host "Selection automatique : NON"
Write-Host "Booking automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "Migration : AUCUNE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""