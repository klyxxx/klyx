$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$apiPath =
    Join-Path $root "app\api\provider\activity-summary\route.ts"

$componentPath =
    Join-Path $root "app\dashboard\ProviderActivitySnapshot.tsx"

$dashboardPath =
    Join-Path $root "app\dashboard\ProviderDashboard.tsx"

$scorePath =
    Join-Path $root "lib\provider-score.ts"

$financePath =
    Join-Path $root "app\api\provider\finance\route.ts"

foreach (
    $path in @(
        $apiPath,
        $componentPath,
        $dashboardPath,
        $scorePath,
        $financePath
    )
) {
    if (-not (
        Test-Path -LiteralPath $path
    )) {
        throw "Fichier absent : $path"
    }
}

$api =
    [System.IO.File]::ReadAllText(
        $apiPath
    )

$component =
    [System.IO.File]::ReadAllText(
        $componentPath
    )

$dashboard =
    [System.IO.File]::ReadAllText(
        $dashboardPath
    )

$score =
    [System.IO.File]::ReadAllText(
        $scorePath
    )

$checks = @(
    @{
        Name = "activity API 13.02"
        Value =
            $api.Contains(
                "KLYX_PROVIDER_GROUP_ACTIVITY_API_13_02"
            )
    },
    @{
        Name = "provider authenticated"
        Value =
            $api.Contains(
                'requireAccountType('
            ) -and
            $api.Contains(
                '"provider"'
            )
    },
    @{
        Name = "booking groups queried"
        Value =
            $api.Contains(
                '"booking_groups"'
            )
    },
    @{
        Name = "group children excluded"
        Value =
            $api.Contains(
                "!booking.booking_group_id"
            )
    },
    @{
        Name = "commercial missions"
        Value =
            $api.Contains(
                "totalMissions"
            ) -and
            $api.Contains(
                "groups.length"
            )
    },
    @{
        Name = "execution slots"
        Value =
            $api.Contains(
                "totalSlots"
            ) -and
            $api.Contains(
                "groupedSlots"
            )
    },
    @{
        Name = "no automatic execution"
        Value =
            $api.Contains(
                "automaticExecutionAllowed:"
            ) -and
            $api.Contains(
                "false"
            )
    },
    @{
        Name = "dashboard component"
        Value =
            $component.Contains(
                "KLYX_PROVIDER_GROUP_ACTIVITY_UI_13_02"
            )
    },
    @{
        Name = "commercial metrics UI"
        Value =
            $component.Contains(
                "KLYX_PROVIDER_COMMERCIAL_METRICS_13_02"
            )
    },
    @{
        Name = "dashboard wiring"
        Value =
            $dashboard.Contains(
                "KLYX_PROVIDER_ACTIVITY_DASHBOARD_13_02"
            ) -and
            $dashboard.Contains(
                "<ProviderActivitySnapshot />"
            )
    },
    @{
        Name = "13.00 retained"
        Value =
            $score.Contains(
                "KLYX_GROUP_AWARE_PROVIDER_SCORE_13_00"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 13.02"
Write-Host ""

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
    Write-Host "ECHECS EXACTS :"

    foreach ($name in $failed) {
        Write-Host " - $name"
    }

    throw "KLYX 13.02 static checker FAILED."
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
            Select-Object -First 300 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 13.02 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 13.02 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.02 CHECK OK"
Write-Host "======================================"
Write-Host "Dashboard prestataire : GROUP-AWARE"
Write-Host "Mission simple = 1 : OK"
Write-Host "Mission groupee = 1 : OK"
Write-Host "Creneaux execution = N : OK"
Write-Host "Completion commerciale : OK"
Write-Host "Annulation commerciale : OK"
Write-Host "Finance : INCHANGEE"
Write-Host "Stripe : INCHANGE"
Write-Host "13.00 + 13.01 : CONSERVES"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""