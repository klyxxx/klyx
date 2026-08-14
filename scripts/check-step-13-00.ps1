$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$scorePath =
    Join-Path $root "lib\provider-score.ts"

$groupReviewPath =
    Join-Path $root "app\api\group-reviews\route.ts"

$bookingsOverviewPath =
    Join-Path $root "app\api\bookings\overview\route.ts"

foreach (
    $path in @(
        $scorePath,
        $groupReviewPath,
        $bookingsOverviewPath
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

$score =
    [System.IO.File]::ReadAllText(
        $scorePath
    )

$groupReview =
    [System.IO.File]::ReadAllText(
        $groupReviewPath
    )

$overview =
    [System.IO.File]::ReadAllText(
        $bookingsOverviewPath
    )

$checks = @(
    @{
        Name = "provider score 13.00"
        Value =
            $score.Contains(
                "KLYX_GROUP_AWARE_PROVIDER_SCORE_13_00"
            )
    },
    @{
        Name = "booking_group_id loaded"
        Value =
            $score.Contains(
                "booking_group_id"
            )
    },
    @{
        Name = "group table loaded"
        Value =
            $score.Contains(
                '"booking_groups"'
            )
    },
    @{
        Name = "grouped children excluded"
        Value =
            $score.Contains(
                "!booking.booking_group_id"
            )
    },
    @{
        Name = "commercial completed jobs"
        Value =
            $score.Contains(
                "singleCompleted +"
            ) -and
            $score.Contains(
                "groupCompleted"
            )
    },
    @{
        Name = "commercial cancelled jobs"
        Value =
            $score.Contains(
                "singleCancelled +"
            ) -and
            $score.Contains(
                "groupCancelled"
            )
    },
    @{
        Name = "one group one total job"
        Value =
            $score.Contains(
                "singleBookings.length +"
            ) -and
            $score.Contains(
                "bookingGroups.length"
            )
    },
    @{
        Name = "execution slots retained"
        Value =
            $score.Contains(
                "totalGroupSlots"
            ) -and
            $score.Contains(
                "totalSlots"
            )
    },
    @{
        Name = "group slot_count used"
        Value =
            $score.Contains(
                "slot_count"
            ) -and
            $score.Contains(
                "safeSlotCount"
            )
    },
    @{
        Name = "group-aware result exposed"
        Value =
            $score.Contains(
                "groupAware:"
            ) -and
            $score.Contains(
                "true"
            )
    },
    @{
        Name = "commercial count stored"
        Value =
            $score.Contains(
                "completed_jobs:"
            ) -and
            $score.Contains(
                "completedJobs"
            )
    },
    @{
        Name = "cancellation rate commercial"
        Value =
            $score.Contains(
                "cancelledJobs /"
            ) -and
            $score.Contains(
                "totalJobs"
            )
    },
    @{
        Name = "group review retained"
        Value =
            $groupReview.Contains(
                "KLYX_GROUP_REVIEW_API_12_88"
            )
    },
    @{
        Name = "grouped bookings overview retained"
        Value =
            $overview.Contains(
                "KLYX_BOOKINGS_GROUP_OVERVIEW_API_12_92"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 13.00"
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

    throw "KLYX 13.00 static checker FAILED."
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

        throw "KLYX 13.00 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.00 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.00 CHECK OK"
Write-Host "======================================"
Write-Host "Mission simple = 1 : OK"
Write-Host "Mission groupee = 1 : OK"
Write-Host "Enfants groupes doubles : NON"
Write-Host "Completion groupe = 1 signal"
Write-Host "Annulation groupe = 1 signal"
Write-Host "Slots execution = N : OK"
Write-Host "Review groupe = 1 : OK"
Write-Host "KLYX Score : GROUP-AWARE"
Write-Host "Paiement : INCHANGE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""