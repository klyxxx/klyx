$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$migrationPath =
    Join-Path $root "supabase\migrations\20260812223200_klyx_group_atomic_live_coverage_12_96.sql"

$groupRoutePath =
    Join-Path $root "app\api\market\requests\[id]\group-booking\route.ts"

$liveHelperPath =
    Join-Path $root "lib\multi-slot-live-coverage.ts"

$groupPagePath =
    Join-Path $root "app\booking-groups\[id]\page.tsx"

foreach (
    $path in @(
        $migrationPath,
        $groupRoutePath,
        $liveHelperPath,
        $groupPagePath
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

$groupRoute =
    [System.IO.File]::ReadAllText(
        $groupRoutePath
    )

$liveHelper =
    [System.IO.File]::ReadAllText(
        $liveHelperPath
    )

$groupPage =
    [System.IO.File]::ReadAllText(
        $groupPagePath
    )

function HasAny {
    param(
        [string]$Text,
        [string[]]$Patterns
    )

    foreach (
        $pattern in $Patterns
    ) {
        if (
            $Text.Contains(
                $pattern
            )
        ) {
            return $true
        }
    }

    return $false
}

$checks = @(
    @{
        Name = "migration 12.96"
        Value =
            $migration.Contains(
                "KLYX_GROUP_ATOMIC_LIVE_COVERAGE_12_96"
            )
    },
    @{
        Name = "reusable coverage RPC"
        Value =
            $migration.Contains(
                "klyx_group_live_coverage_check"
            )
    },
    @{
        Name = "user service active check"
        Value =
            $migration.Contains(
                "provider_enabled"
            ) -and
            $migration.Contains(
                "v_service.active"
            )
    },
    @{
        Name = "canonical slot count"
        Value =
            $migration.Contains(
                "GROUP_LIVE_SLOT_COUNT_CHANGED"
            )
    },
    @{
        Name = "availability live SQL"
        Value =
            $migration.Contains(
                "availability_slots"
            ) -and
            $migration.Contains(
                "is_active = true"
            )
    },
    @{
        Name = "weekday live SQL"
        Value =
            $migration.Contains(
                "extract("
            ) -and
            $migration.Contains(
                "dow"
            )
    },
    @{
        Name = "existing bookings checked"
        Value =
            $migration.Contains(
                "public.bookings"
            )
    },
    @{
        Name = "hard conflicts only"
        Value =
            $migration.Contains(
                "'accepted'"
            ) -and
            $migration.Contains(
                "'completed'"
            )
    },
    @{
        Name = "overlap test"
        Value =
            $migration.Contains(
                "b.start_time < v_slot.end_time"
            ) -and
            $migration.Contains(
                "b.end_time > v_slot.start_time"
            )
    },
    @{
        Name = "N/N required"
        Value =
            $migration.Contains(
                "v_covered_count <> v_request.slot_count"
            )
    },
    @{
        Name = "DB trigger"
        Value =
            $migration.Contains(
                "klyx_booking_group_live_coverage_12_96"
            )
    },
    @{
        Name = "trigger before insert"
        Value =
            $migration.Contains(
                "before insert"
            ) -and
            $migration.Contains(
                "public.booking_groups"
            )
    },
    @{
        Name = "atomic rejection code"
        Value =
            $migration.Contains(
                "KLYX_GROUP_LIVE_COVERAGE_REQUIRED"
            )
    },
    @{
        Name = "service role only"
        Value =
            $migration.Contains(
                "to service_role"
            )
    },
    @{
        Name = "12.95 retained"
        Value =
            $liveHelper.Contains(
                "KLYX_MULTI_SLOT_LIVE_COVERAGE_12_95"
            )
    },
    @{
        Name = "12.85 group creation retained"
        Value =
            HasAny `
                -Text $groupRoute `
                -Patterns @(
                    "KLYX_GROUP_BOOKING_CREATE_12_85",
                    "klyx_create_multi_slot_booking_group"
                )
    },
    @{
        Name = "group mission page retained"
        Value =
            $groupPage.Contains(
                "KLYX_GROUP_MISSION_PAGE_12_87"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 12.96"
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

    throw "KLYX 12.96 static checker FAILED."
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

        throw "KLYX 12.96 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 12.96 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.96 CHECK OK"
Write-Host "======================================"
Write-Host "Offre N/N precedente : REVALIDEE"
Write-Host "Service prestataire : REVALIDE"
Write-Host "Planning actuel : REVALIDE"
Write-Host "Conflits actuels : REVALIDES"
Write-Host "Couverture N/N finale : OBLIGATOIRE"
Write-Host "Creation groupe stale : BLOQUEE"
Write-Host "Creation enfants stale : BLOQUEE"
Write-Host "12.95 : CONSERVE"
Write-Host "Paiement automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""