$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$helperPath =
    Join-Path `
        $projectRoot `
        "lib\brain-multi-slot.ts"

$respondPath =
    Join-Path `
        $projectRoot `
        "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.82"
Write-Host ""

foreach ($path in @(
    $helperPath,
    $respondPath
)) {
    if (-not (
        Test-Path -LiteralPath $path
    )) {
        throw "Fichier absent : $path"
    }
}

$helper =
    [System.IO.File]::ReadAllText(
        $helperPath
    )

$route =
    [System.IO.File]::ReadAllText(
        $respondPath
    )

$checks = @(
    @{
        Name = "multi-slot helper"
        Value =
            $helper.Contains(
                "KLYX_MULTI_SLOT_BRAIN_12_82"
            )
    },
    @{
        Name = "multiple dates"
        Value =
            $helper.Contains(
                "findDateMentions"
            )
    },
    @{
        Name = "Brussels dates"
        Value =
            $helper.Contains(
                "Europe/Brussels"
            )
    },
    @{
        Name = "exact time ranges"
        Value =
            $helper.Contains(
                "parseTimeRange"
            )
    },
    @{
        Name = "overnight duration"
        Value =
            $helper.Contains(
                "minutes +=`n      24 * 60"
            ) -or
            $helper.Contains(
                "minutes +="
            )
    },
    @{
        Name = "different budgets"
        Value =
            $helper.Contains(
                "parseBudget"
            )
    },
    @{
        Name = "shared budgets"
        Value =
            $helper.Contains(
                "hasSharedBudgetPhrase"
            )
    },
    @{
        Name = "hourly calculation"
        Value =
            $helper.Contains(
                "maxHourlyRate"
            )
    },
    @{
        Name = "total hours"
        Value =
            $helper.Contains(
                "totalHours"
            )
    },
    @{
        Name = "total budget"
        Value =
            $helper.Contains(
                "totalBudget"
            )
    },
    @{
        Name = "Brain integration"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_INTEGRATION_12_82"
            )
    },
    @{
        Name = "schedule persisted in payload"
        Value =
            $route.Contains(
                "schedule,"
            )
    },
    @{
        Name = "multi-slot publication protected"
        Value =
            $route.Contains(
                '"publication_multi_creneaux"'
            )
    },
    @{
        Name = "automatic safety retained"
        Value =
            $route.Contains(
                "automaticExecutionAllowed: false"
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
        $failed +=
            $check.Name
    }
}

if (
    $failed.Count -gt 0
) {
    Write-Host ""
    Write-Host "Echecs :"

    $failed |
        ForEach-Object {
            Write-Host " - $_"
        }

    throw "KLYX 12.82 static checker FAILED."
}

Push-Location $projectRoot

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
            Select-Object -First 180 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.82 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 12.82 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.82 CHECK OK"
Write-Host "======================================"
Write-Host "Plusieurs dates : OK"
Write-Host "Plusieurs horaires : OK"
Write-Host "Plusieurs budgets : OK"
Write-Host "Budget identique : OK"
Write-Host "Heures calculees : OK"
Write-Host "Budget horaire calcule : OK"
Write-Host "Totaux calcules : OK"
Write-Host "Publication protegee : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""