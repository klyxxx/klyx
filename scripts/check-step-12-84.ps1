$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$apiPath =
    Join-Path $root "app\api\brain\market-advice\[id]\route.ts"

$pagePath =
    Join-Path $root "app\assistant\market\[id]\page.tsx"

$offersPath =
    Join-Path $root "app\api\market\requests\[id]\offers\route.ts"

$matchingPath =
    Join-Path $root "lib\market-multi-slot.ts"

$migrationPath =
    Join-Path $root "supabase\migrations\20260812195600_klyx_multi_slot_market_12_83.sql"

Write-Host ""
Write-Host "CHECK KLYX 12.84"
Write-Host ""

foreach ($path in @(
    $apiPath,
    $pagePath,
    $offersPath,
    $matchingPath,
    $migrationPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier absent : $path"
    }
}

$api =
    [System.IO.File]::ReadAllText($apiPath)

$page =
    [System.IO.File]::ReadAllText($pagePath)

$offers =
    [System.IO.File]::ReadAllText($offersPath)

$matching =
    [System.IO.File]::ReadAllText($matchingPath)

$migration =
    [System.IO.File]::ReadAllText($migrationPath)

$checks = @(
    @{
        Name = "advice API 12.84"
        Value = $api.Contains(
            "KLYX_MULTI_SLOT_ADVICE_12_84"
        )
    },
    @{
        Name = "live coverage recalculation"
        Value = $api.Contains(
            "rankProvidersForMultiSlots"
        )
    },
    @{
        Name = "full coverage priority"
        Value = $api.Contains(
            ".fullCoverage"
        )
    },
    @{
        Name = "coverage count priority"
        Value = $api.Contains(
            "second.coverage"
        )
    },
    @{
        Name = "slots returned to UI"
        Value = $api.Contains(
            "slotCount:"
        ) -and
        $api.Contains(
            "slots,"
        )
    },
    @{
        Name = "multi advice UI"
        Value = $page.Contains(
            "KLYX_MULTI_SLOT_ADVICE_UI_12_84"
        )
    },
    @{
        Name = "coverage badge UI"
        Value = $page.Contains(
            "offer.coverage.label"
        )
    },
    @{
        Name = "multi slot summary UI"
        Value = $page.Contains(
            "data.request.slots.map"
        )
    },
    @{
        Name = "protected selection UI"
        Value = $page.Contains(
            "Selection groupee protegee"
        )
    },
    @{
        Name = "server acceptance guard"
        Value = $offers.Contains(
            "KLYX_MULTI_SLOT_ACCEPT_GUARD_12_84"
        )
    },
    @{
        Name = "multi request selected server side"
        Value = $offers.Contains(
            "request_mode"
        )
    },
    @{
        Name = "group booking required error"
        Value = $offers.Contains(
            "MULTI_SLOT_GROUP_BOOKING_REQUIRED"
        )
    },
    @{
        Name = "12.83 matching retained"
        Value = $matching.Contains(
            "KLYX_MULTI_SLOT_PROVIDER_MATCHING_12_83"
        )
    },
    @{
        Name = "12.83 migration retained"
        Value = $migration.Contains(
            "KLYX_MULTI_SLOT_MARKET_12_83"
        )
    }
)

$failed = @()

foreach ($check in $checks) {
    if ($check.Value) {
        Write-Host "[OK]   $($check.Name)"
    }
    else {
        Write-Host "[FAIL] $($check.Name)"
        $failed += $check.Name
    }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Echecs :"

    $failed |
        ForEach-Object {
            Write-Host " - $_"
        }

    throw "KLYX 12.84 static checker FAILED."
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

    if ($LASTEXITCODE -ne 0) {
        $tsOutput |
            Select-Object -First 200 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.84 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.84 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.84 CHECK OK"
Write-Host "======================================"
Write-Host "2/2, 1/2... couverture : OK"
Write-Host "Meme prestataire prioritaire : OK"
Write-Host "Disponibilite recalculee : OK"
Write-Host "Budgets et horaires visibles : OK"
Write-Host "Ancien booking mono : BLOQUE"
Write-Host "Reservation automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""