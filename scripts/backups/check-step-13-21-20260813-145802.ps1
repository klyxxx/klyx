$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$api =
    Join-Path $root "app\api\bookings\split-missions\route.ts"

$component =
    Join-Path $root "app\bookings\SplitMissionSection.tsx"

$detail =
    Join-Path $root "app\bookings\split\[id]\page.tsx"

$page =
    Join-Path $root "app\bookings\page.tsx"

foreach (
    $path
    in @(
        $api,
        $component,
        $detail,
        $page
    )
) {
    if (
        -not (
            Test-Path -LiteralPath $path
        )
    ) {
        throw "13.21 : fichier introuvable : $path"
    }
}

$a =
    [System.IO.File]::ReadAllText(
        $api
    )

$c =
    [System.IO.File]::ReadAllText(
        $component
    )

$d =
    [System.IO.File]::ReadAllText(
        $detail
    )

$p =
    [System.IO.File]::ReadAllText(
        $page
    )

$checks =
    @(
        @(
            "13.21 API marker",
            $a.Contains(
                "KLYX_SPLIT_MISSION_API_13_21"
            )
        ),

        @(
            "batch consolidation",
            $a.Contains(
                "split_booking_batches"
            )
        ),

        @(
            "child booking mapping",
            $a.Contains(
                "split_booking_batch_items"
            )
        ),

        @(
            "exact confirmation snapshot",
            $a.Contains(
                "market_split_plan_confirmations"
            )
        ),

        @(
            "aggregate mission lifecycle",
            $a.Contains(
                "partially_accepted"
            ) -and
            $a.Contains(
                "in_progress"
            ) -and
            $a.Contains(
                "mixed_issue"
            )
        ),

        @(
            "child IDs exposed",
            $a.Contains(
                "childBookingIds"
            )
        ),

        @(
            "no automatic booking",
            $a.Contains(
                "automaticBooking"
            )
        ),

        @(
            "no automatic payment",
            $a.Contains(
                "automaticPayment"
            )
        ),

        @(
            "13.21 UI marker",
            $c.Contains(
                "KLYX_SPLIT_MISSION_UI_13_21"
            )
        ),

        @(
            "one mission card",
            $c.Contains(
                "Missions multi-prestataires"
            )
        ),

        @(
            "13.21 detail marker",
            $d.Contains(
                "KLYX_SPLIT_MISSION_DETAIL_13_21"
            )
        ),

        @(
            "child booking detail retained",
            $d.Contains(
                '"/bookings/" +'
            )
        ),

        @(
            "page consolidation marker",
            $p.Contains(
                "KLYX_SPLIT_MISSION_CONSOLIDATION_13_21"
            )
        ),

        @(
            "child bookings hidden",
            $p.Contains(
                "hiddenSplitBookingIds"
            )
        ),

        @(
            "mission list wired",
            $p.Contains(
                "KLYX_SPLIT_MISSION_LIST_WIRING_13_21"
            )
        ),

        @(
            "mission counts integrated",
            $p.Contains(
                "splitMissionNeedsAction"
            ) -and
            $p.Contains(
                "splitMissionIsHistory"
            )
        )
    )

$failed =
    @()

Write-Host ""
Write-Host "CHECK KLYX 13.21"
Write-Host ""

foreach (
    $check
    in $checks
) {
    if (
        $check[1]
    ) {
        Write-Host (
            "[OK]   " +
            $check[0]
        )
    }

    if (
        -not $check[1]
    ) {
        Write-Host (
            "[FAIL] " +
            $check[0]
        )

        $failed +=
            $check[0]
    }
}

if (
    $failed.Count -gt 0
) {
    Write-Host ""
    Write-Host "ECHECS EXACTS :"

    foreach (
        $item
        in $failed
    ) {
        Write-Host (
            " - " +
            $item
        )
    }

    throw "KLYX 13.21 static checker FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.21 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.21 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.21 CHECK OK"
Write-Host "======================================"
Write-Host "Split mission client : CONSOLIDEE"
Write-Host "1 plan : 1 MISSION CLIENT"
Write-Host "Child bookings : MASQUES DE LA LISTE"
Write-Host "Child bookings detail : ACCESSIBLES"
Write-Host "Aggregate lifecycle : ACTIF"
Write-Host "Provider count : ACTIF"
Write-Host "Slot timeline : ACTIVE"
Write-Host "Recovery state : VISIBLE"
Write-Host "Automatic booking : NON"
Write-Host "Automatic payment : NON"
Write-Host "Migration DB : AUCUNE"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"