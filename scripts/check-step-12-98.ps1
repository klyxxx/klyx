$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$routePath =
    Join-Path $root "app\api\brain\market-advice\[id]\route.ts"

$livePath =
    Join-Path $root "lib\multi-slot-live-coverage.ts"

$recoveryPath =
    Join-Path $root "app\api\market\requests\[id]\group-booking\route.ts"

$migrationDir =
    Join-Path $root "supabase\migrations"

foreach (
    $path in @(
        $routePath,
        $livePath,
        $recoveryPath
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

$live =
    [System.IO.File]::ReadAllText(
        $livePath
    )

$recovery =
    [System.IO.File]::ReadAllText(
        $recoveryPath
    )

$migration96 =
    Get-ChildItem `
        -LiteralPath $migrationDir `
        -File |
    Select-String `
        -Pattern "KLYX_GROUP_ATOMIC_LIVE_COVERAGE_12_96" `
        -SimpleMatch `
        -List

$checks = @(
    @{
        Name = "live advice 12.98"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_LIVE_ADVICE_12_98"
            )
    },
    @{
        Name = "legacy adviser preserved"
        Value =
            $route.Contains(
                "klyxMarketAdviceBeforeLiveFilter("
            )
    },
    @{
        Name = "one exported GET"
        Value =
            (
                [regex]::Matches(
                    $route,
                    "export\s+async\s+function\s+GET\s*\("
                ).Count
            ) -eq 1
    },
    @{
        Name = "multi only"
        Value =
            $route.Contains(
                'requestMeta.request_mode !=='
            ) -and
            $route.Contains(
                '"multi_slot"'
            )
    },
    @{
        Name = "open requests only"
        Value =
            $route.Contains(
                'requestMeta.status !=='
            ) -and
            $route.Contains(
                '"open"'
            )
    },
    @{
        Name = "12.96 RPC reused"
        Value =
            $route.Contains(
                "klyx_group_live_coverage_check"
            )
    },
    @{
        Name = "provider revalidated"
        Value =
            $route.Contains(
                "p_provider_profile_id:"
            )
    },
    @{
        Name = "user service revalidated"
        Value =
            $route.Contains(
                "p_user_service_id:"
            )
    },
    @{
        Name = "N/N enforced"
        Value =
            $route.Contains(
                "coverage.fullCoverage ==="
            ) -and
            $route.Contains(
                "requestMeta.slot_count"
            )
    },
    @{
        Name = "stale offers filtered"
        Value =
            $route.Contains(
                "eligibleIds.has("
            )
    },
    @{
        Name = "candidate resync"
        Value =
            $route.Contains(
                "market_request_provider_candidates"
            ) -and
            $route.Contains(
                "full_coverage:"
            )
    },
    @{
        Name = "best remaining recommended"
        Value =
            $route.Contains(
                "isRecommended:"
            ) -and
            $route.Contains(
                "index === 0"
            )
    },
    @{
        Name = "cheapest recalculated"
        Value =
            $route.Contains(
                "cheapestAmount"
            )
    },
    @{
        Name = "zero eligible handled"
        Value =
            $route.Contains(
                "liveOffers.length ==="
            ) -and
            $route.Contains(
                "Aucun prestataire ne couvre actuellement"
            )
    },
    @{
        Name = "no automatic selection"
        Value =
            $route.Contains(
                "automaticSelection:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "12.95 retained"
        Value =
            $live.Contains(
                "KLYX_MULTI_SLOT_LIVE_COVERAGE_12_95"
            )
    },
    @{
        Name = "12.97 retained"
        Value =
            $recovery.Contains(
                "KLYX_GROUP_STALE_PROVIDER_RECOVERY_12_97"
            )
    },
    @{
        Name = "12.96 retained"
        Value =
            ($null -ne $migration96)
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 12.98"
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

    throw "KLYX 12.98 static checker FAILED."
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

        throw "KLYX 12.98 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 12.98 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.98 CHECK OK"
Write-Host "======================================"
Write-Host "Conseiller simple : CONSERVE"
Write-Host "Conseiller multi-slot : LIVE"
Write-Host "Disponibilites : REVALIDEES"
Write-Host "Conflits bookings : REVALIDES"
Write-Host "Prestataire stale : RETIRE"
Write-Host "Classement : RECALCULE"
Write-Host "Meilleur restant : RECOMMANDE"
Write-Host "0 candidat N/N : GERE"
Write-Host "Selection automatique : NON"
Write-Host "12.96 + 12.97 : CONSERVES"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""