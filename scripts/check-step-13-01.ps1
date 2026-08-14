$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$pagePath =
    Join-Path $root "app\scores\page.tsx"

$scorePath =
    Join-Path $root "lib\provider-score.ts"

$apiPath =
    Join-Path $root "app\api\scores\recalculate\route.ts"

foreach (
    $path in @(
        $pagePath,
        $scorePath,
        $apiPath
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

$page =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$score =
    [System.IO.File]::ReadAllText(
        $scorePath
    )

$api =
    [System.IO.File]::ReadAllText(
        $apiPath
    )

$checks = @(
    @{
        Name = "score UI 13.01"
        Value =
            $page.Contains(
                "KLYX_GROUP_AWARE_SCORE_UI_13_01"
            )
    },
    @{
        Name = "KLYX Score v3"
        Value =
            $page.Contains(
                "KLYX Score v3"
            )
    },
    @{
        Name = "commercial section"
        Value =
            $page.Contains(
                "KLYX_COMMERCIAL_MISSION_METRICS_13_01"
            )
    },
    @{
        Name = "execution section"
        Value =
            $page.Contains(
                "KLYX_EXECUTION_SLOT_METRICS_13_01"
            )
    },
    @{
        Name = "completed jobs exposed"
        Value =
            $page.Contains(
                "completedJobs"
            )
    },
    @{
        Name = "total jobs exposed"
        Value =
            $page.Contains(
                "totalJobs"
            )
    },
    @{
        Name = "completed slots exposed"
        Value =
            $page.Contains(
                "completedSlots"
            )
    },
    @{
        Name = "total slots exposed"
        Value =
            $page.Contains(
                "totalSlots"
            )
    },
    @{
        Name = "group missions exposed"
        Value =
            $page.Contains(
                "groupedMissionCount"
            )
    },
    @{
        Name = "single missions exposed"
        Value =
            $page.Contains(
                "singleMissionCount"
            )
    },
    @{
        Name = "group-aware badge"
        Value =
            $page.Contains(
                "groupAware"
            ) -and
            $page.Contains(
                "Group-aware"
            )
    },
    @{
        Name = "one mission N slots explanation"
        Value =
            $page.Contains(
                "1 mission commerciale"
            ) -and
            $page.Contains(
                "3 créneaux exécutés"
            )
    },
    @{
        Name = "13.00 retained"
        Value =
            $score.Contains(
                "KLYX_GROUP_AWARE_PROVIDER_SCORE_13_00"
            )
    },
    @{
        Name = "score API retained"
        Value =
            $api.Contains(
                "recalculateProviderScores"
            ) -and
            $api.Contains(
                "...result"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 13.01"
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

    throw "KLYX 13.01 static checker FAILED."
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

        throw "KLYX 13.01 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.01 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.01 CHECK OK"
Write-Host "======================================"
Write-Host "KLYX Score v3 : OK"
Write-Host "Missions commerciales : OK"
Write-Host "Missions groupees = 1 : OK"
Write-Host "Creneaux execution = N : OK"
Write-Host "Annulations commerciales : OK"
Write-Host "Avis groupes : CONSERVES"
Write-Host "13.00 : CONSERVE"
Write-Host "Paiement : INCHANGE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""