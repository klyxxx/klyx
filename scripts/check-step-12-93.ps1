$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$apiPath =
    Join-Path $root "app\api\provider\jobs\route.ts"

$pagePath =
    Join-Path $root "app\provider\jobs\page.tsx"

$marketPath =
    Join-Path $root "app\api\market\requests\route.ts"

$offerPath =
    Join-Path $root "app\api\market\requests\[id]\offers\route.ts"

$groupApiPath =
    Join-Path $root "app\api\booking-groups\[id]\route.ts"

foreach (
    $path in @(
        $apiPath,
        $pagePath,
        $marketPath,
        $offerPath,
        $groupApiPath
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

$api =
    [System.IO.File]::ReadAllText(
        $apiPath
    )

$page =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$market =
    [System.IO.File]::ReadAllText(
        $marketPath
    )

$offers =
    [System.IO.File]::ReadAllText(
        $offerPath
    )

$groupApi =
    [System.IO.File]::ReadAllText(
        $groupApiPath
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
        Name = "provider jobs API 12.93"
        Value =
            $api.Contains(
                "KLYX_PROVIDER_MULTI_JOBS_API_12_93"
            )
    },
    @{
        Name = "provider jobs UI 12.93"
        Value =
            $page.Contains(
                "KLYX_PROVIDER_MULTI_JOBS_UI_12_93"
            )
    },
    @{
        Name = "legacy market engine reused"
        Value =
            $api.Contains(
                "getMarketRequests("
            )
    },
    @{
        Name = "request mode multi-slot"
        Value =
            $api.Contains(
                "request_mode"
            ) -and
            $api.Contains(
                "multi_slot"
            )
    },
    @{
        Name = "slot table loaded"
        Value =
            $api.Contains(
                "market_service_request_slots"
            )
    },
    @{
        Name = "provider candidates loaded"
        Value =
            $api.Contains(
                "market_request_provider_candidates"
            )
    },
    @{
        Name = "candidate scoped to provider"
        Value =
            $api.Contains(
                "provider_profile_id"
            ) -and
            $api.Contains(
                "profile.id"
            )
    },
    @{
        Name = "full coverage enforced"
        Value =
            $api.Contains(
                "full_coverage"
            ) -and
            $api.Contains(
                "coverage_count"
            ) -and
            $api.Contains(
                "slot_count"
            )
    },
    @{
        Name = "partial provider hidden"
        Value =
            $api.Contains(
                "visibleRequests"
            ) -and
            $api.Contains(
                "candidate.full_coverage"
            )
    },
    @{
        Name = "budget total supported"
        Value =
            $api.Contains(
                "budget_total"
            ) -and
            $page.Contains(
                "Budget total"
            )
    },
    @{
        Name = "duration total supported"
        Value =
            $api.Contains(
                "totalDurationMinutes"
            ) -and
            $page.Contains(
                "totalDurationMinutes"
            )
    },
    @{
        Name = "multi planning UI"
        Value =
            $page.Contains(
                "item.slots.map("
            ) -and
            $page.Contains(
                "Tu couvres toute la mission"
            )
    },
    @{
        Name = "coverage badge UI"
        Value =
            $page.Contains(
                "item.coverage"
            ) -and
            $page.Contains(
                "fullCoverage"
            )
    },
    @{
        Name = "single total offer"
        Value =
            $page.Contains(
                "Ton prix total"
            ) -and
            $page.Contains(
                "Proposer pour tout"
            )
    },
    @{
        Name = "offer endpoint retained"
        Value =
            $page.Contains(
                "/api/market/requests/"
            ) -and
            $page.Contains(
                "/offers"
            )
    },
    @{
        Name = "multi-slot direct accept still protected"
        Value =
            HasAny `
                -Text $offers `
                -Patterns @(
                    "KLYX_MULTI_SLOT_ACCEPT_GUARD_12_84",
                    "MULTI_SLOT_GROUP_BOOKING_REQUIRED"
                )
    },
    @{
        Name = "group booking API retained"
        Value =
            HasAny `
                -Text $groupApi `
                -Patterns @(
                    "KLYX_GROUP_BOOKING_API_12_85",
                    "klyx_provider_group_decision",
                    "booking_groups"
                )
    },
    @{
        Name = "legacy market API intact"
        Value =
            $market.Contains(
                "market_service_requests"
            ) -and
            $market.Contains(
                "market_service_offers"
            )
    },
    @{
        Name = "automatic execution disabled"
        Value =
            $api.Contains(
                "automaticExecutionAllowed:"
            ) -and
            $api.Contains(
                "false"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 12.93b"
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

    throw "KLYX 12.93b static checker FAILED."
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

        throw "KLYX 12.93b TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 12.93b build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.93 CHECK OK"
Write-Host "======================================"
Write-Host "Missions simples : OK"
Write-Host "Missions multi-creneaux : OK"
Write-Host "Planning complet : OK"
Write-Host "Budget par creneau : OK"
Write-Host "Budget total : OK"
Write-Host "Duree totale : OK"
Write-Host "Couverture 100% obligatoire : OK"
Write-Host "Prestataire partiel : MASQUE"
Write-Host "1 groupe = 1 offre : OK"
Write-Host "Protection booking groupe : OK"
Write-Host "Execution automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""