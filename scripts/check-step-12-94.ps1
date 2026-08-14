$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$routePath =
    Join-Path $root "app\api\market\requests\[id]\offers\route.ts"

$providerJobsPath =
    Join-Path $root "app\api\provider\jobs\route.ts"

$providerJobsPagePath =
    Join-Path $root "app\provider\jobs\page.tsx"

$groupCreatePath =
    Join-Path $root "app\api\market\requests\[id]\group-booking\route.ts"

foreach (
    $path in @(
        $routePath,
        $providerJobsPath,
        $providerJobsPagePath,
        $groupCreatePath
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

$providerJobs =
    [System.IO.File]::ReadAllText(
        $providerJobsPath
    )

$providerJobsPage =
    [System.IO.File]::ReadAllText(
        $providerJobsPagePath
    )

$groupCreate =
    [System.IO.File]::ReadAllText(
        $groupCreatePath
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
        Name = "server guard 12.94"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_OFFER_SERVER_GUARD_12_94"
            )
    },
    @{
        Name = "multi request detected"
        Value =
            $route.Contains(
                "request_mode"
            ) -and
            $route.Contains(
                "multi_slot"
            )
    },
    @{
        Name = "candidate server lookup"
        Value =
            $route.Contains(
                "market_request_provider_candidates"
            )
    },
    @{
        Name = "candidate belongs to provider"
        Value =
            $route.Contains(
                'candidate.provider_profile_id ==='
            ) -and
            $route.Contains(
                "profile.id"
            )
    },
    @{
        Name = "candidate belongs to request"
        Value =
            $route.Contains(
                'candidate.market_request_id ==='
            )
    },
    @{
        Name = "full coverage required"
        Value =
            $route.Contains(
                'candidate.full_coverage ==='
            ) -and
            $route.Contains(
                "coverageCount ==="
            )
    },
    @{
        Name = "real slot count checked"
        Value =
            $route.Contains(
                "market_service_request_slots"
            ) -and
            $route.Contains(
                "actualSlotCount !=="
            )
    },
    @{
        Name = "slot positions checked"
        Value =
            $route.Contains(
                "uniquePositions"
            )
    },
    @{
        Name = "partial provider returns 403"
        Value =
            $route.Contains(
                "MULTI_SLOT_FULL_COVERAGE_REQUIRED"
            ) -and
            $route.Contains(
                "status: 403"
            )
    },
    @{
        Name = "schedule mutation protected"
        Value =
            $route.Contains(
                "MULTI_SLOT_SCHEDULE_CHANGED"
            )
    },
    @{
        Name = "positive group offer required"
        Value =
            $route.Contains(
                "MULTI_SLOT_INVALID_OFFER_AMOUNT"
            )
    },
    @{
        Name = "offer still upserted after guard"
        Value =
            $route.Contains(
                '.from("market_service_offers")'
            ) -and
            $route.Contains(
                ".upsert("
            )
    },
    @{
        Name = "provider jobs 12.93 retained"
        Value =
            $providerJobs.Contains(
                "KLYX_PROVIDER_MULTI_JOBS_API_12_93"
            )
    },
    @{
        Name = "provider jobs UI 12.93 retained"
        Value =
            $providerJobsPage.Contains(
                "KLYX_PROVIDER_MULTI_JOBS_UI_12_93"
            )
    },
    @{
        Name = "group booking 12.85 retained"
        Value =
            HasAny `
                -Text $groupCreate `
                -Patterns @(
                    "KLYX_GROUP_BOOKING_CREATE_12_85",
                    "klyx_create_multi_slot_booking_group"
                )
    },
    @{
        Name = "multi accept guard retained"
        Value =
            HasAny `
                -Text $route `
                -Patterns @(
                    "KLYX_MULTI_SLOT_ACCEPT_GUARD_12_84",
                    "MULTI_SLOT_GROUP_BOOKING_REQUIRED"
                )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 12.94"
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

    throw "KLYX 12.94 static checker FAILED."
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

        throw "KLYX 12.94 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 12.94 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.94 CHECK OK"
Write-Host "======================================"
Write-Host "UI 12.93 : CONSERVEE"
Write-Host "API offre multi : PROTEGEE"
Write-Host "Prestataire N/N : AUTORISE"
Write-Host "Prestataire partiel : BLOQUE SERVEUR"
Write-Host "Contournement API : BLOQUE"
Write-Host "Planning incoherent : BLOQUE"
Write-Host "Prix total invalide : BLOQUE"
Write-Host "Missions simples : CONSERVEES"
Write-Host "Booking groupe : CONSERVE"
Write-Host "Execution automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""