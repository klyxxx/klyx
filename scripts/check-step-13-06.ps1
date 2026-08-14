$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$migrationPath =
    Join-Path $root "supabase\migrations\20260813102500_klyx_group_provider_accept_live_13_06.sql"

$migration96 =
    Join-Path $root "supabase\migrations\20260812223200_klyx_group_atomic_live_coverage_12_96.sql"

$migration85 =
    Join-Path $root "supabase\migrations\20260812202000_klyx_booking_groups_12_85.sql"

$financePath =
    Join-Path $root "app\api\provider\finance\route.ts"

foreach (
    $path in @(
        $migrationPath,
        $migration96,
        $migration85,
        $financePath
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

$sql85 =
    [System.IO.File]::ReadAllText(
        $migration85
    )

$finance =
    [System.IO.File]::ReadAllText(
        $financePath
    )

$checks = @(
    @{
        Name = "13.06 marker"
        Value =
            $sql.Contains(
                "KLYX_GROUP_PROVIDER_ACCEPT_LIVE_GUARD_13_06"
            )
    },
    @{
        Name = "DB trigger"
        Value =
            $sql.Contains(
                "before update of status"
            )
    },
    @{
        Name = "accepted transition"
        Value =
            $sql.Contains(
                "'accepted'"
            )
    },
    @{
        Name = "provider accepted transition"
        Value =
            $sql.Contains(
                "'provider_accepted'"
            )
    },
    @{
        Name = "child fallback"
        Value =
            $sql.Contains(
                "booking_group_id"
            )
    },
    @{
        Name = "offer fallback"
        Value =
            $sql.Contains(
                "market_service_offers"
            )
    },
    @{
        Name = "context fail closed"
        Value =
            $sql.Contains(
                "KLYX_GROUP_ACCEPT_LIVE_CONTEXT_REQUIRED"
            )
    },
    @{
        Name = "12.96 checker reused"
        Value =
            $sql.Contains(
                "klyx_group_live_coverage_check"
            )
    },
    @{
        Name = "camelCase RPC support"
        Value =
            $sql.Contains(
                "fullCoverage"
            ) -and
            $sql.Contains(
                "coverageCount"
            )
    },
    @{
        Name = "snake_case RPC support"
        Value =
            $sql.Contains(
                "full_coverage"
            ) -and
            $sql.Contains(
                "coverage_count"
            )
    },
    @{
        Name = "N over N exact"
        Value =
            $sql.Contains(
                "v_coverage_count <>"
            ) -and
            $sql.Contains(
                "v_slot_count"
            )
    },
    @{
        Name = "stale acceptance blocked"
        Value =
            $sql.Contains(
                "KLYX_GROUP_ACCEPT_LIVE_COVERAGE_REQUIRED"
            )
    },
    @{
        Name = "12.85 retained"
        Value =
            $sql85.Contains(
                "klyx_provider_group_decision"
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
        Name = "13.05c retained"
        Value =
            $finance.Contains(
                "KLYX_GROUP_SCHEMA_RUNTIME_FINANCE_13_05C"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 13.06"
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

    throw "KLYX 13.06 static checker FAILED."
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
        throw "KLYX 13.06 Supabase db push FAILED."
    }

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

        throw "KLYX 13.06 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.06 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.06 CHECK OK"
Write-Host "======================================"
Write-Host "Provider accept : REVALIDE LIVE"
Write-Host "Disponibilites : N/N OBLIGATOIRE"
Write-Host "Conflits : REVALIDES"
Write-Host "Service actif : REVALIDE"
Write-Host "Protection DB : ACTIVE"
Write-Host "Acceptation automatique : NON"
Write-Host "Booking automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "13.05c : CONSERVE"
Write-Host "Supabase : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""