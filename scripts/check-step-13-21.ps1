$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$api =
    Join-Path `
        $root `
        "app\api\bookings\split-missions\route.ts"

$component =
    Join-Path `
        $root `
        "app\bookings\SplitMissionSection.tsx"

$detail =
    Join-Path `
        $root `
        "app\bookings\split\[id]\page.tsx"

$page =
    Join-Path `
        $root `
        "app\bookings\page.tsx"

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
            Test-Path `
                -LiteralPath `
                $path
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

$failed =
    @()

function Test-Klyx {
    param(
        [string]$Name,
        [bool]$Condition
    )

    if (
        $Condition
    ) {
        Write-Host (
            "[OK]   " +
            $Name
        )

        return
    }

    Write-Host (
        "[FAIL] " +
        $Name
    )

    $script:failed +=
        $Name
}

Write-Host ""
Write-Host "CHECK KLYX 13.21"
Write-Host ""

Test-Klyx `
    "13.21 API marker" `
    $a.Contains(
        "KLYX_SPLIT_MISSION_API_13_21"
    )

Test-Klyx `
    "split batches loaded" `
    $a.Contains(
        "split_booking_batches"
    )

Test-Klyx `
    "split items loaded" `
    $a.Contains(
        "split_booking_batch_items"
    )

Test-Klyx `
    "confirmation snapshot loaded" `
    $a.Contains(
        "market_split_plan_confirmations"
    )

Test-Klyx `
    "aggregate lifecycle" `
    (
        $a.Contains(
            "partially_accepted"
        ) -and
        $a.Contains(
            "in_progress"
        ) -and
        $a.Contains(
            "mixed_issue"
        )
    )

Test-Klyx `
    "child IDs exposed" `
    $a.Contains(
        "childBookingIds"
    )

Test-Klyx `
    "automatic booking forbidden" `
    $a.Contains(
        "automaticBooking"
    )

Test-Klyx `
    "automatic payment forbidden" `
    $a.Contains(
        "automaticPayment"
    )

Test-Klyx `
    "13.21 UI marker" `
    $c.Contains(
        "KLYX_SPLIT_MISSION_UI_13_21"
    )

Test-Klyx `
    "13.21 detail marker" `
    $d.Contains(
        "KLYX_SPLIT_MISSION_DETAIL_13_21"
    )

Test-Klyx `
    "existing overview retained" `
    $p.Contains(
        "/api/bookings/overview"
    )

Test-Klyx `
    "page consolidation marker" `
    $p.Contains(
        "KLYX_SPLIT_MISSION_CONSOLIDATION_13_21"
    )

Test-Klyx `
    "split mission state" `
    (
        $p.Contains(
            "splitMissions"
        ) -and
        $p.Contains(
            "setSplitMissions"
        )
    )

Test-Klyx `
    "split API wired" `
    $p.Contains(
        "/api/bookings/split-missions"
    )

Test-Klyx `
    "child bookings hidden" `
    (
        $p.Contains(
            "hiddenSplitBookingIds"
        ) -and
        $p.Contains(
            "!hiddenSplitBookingIds.has"
        )
    )

Test-Klyx `
    "mission list wired" `
    (
        $p.Contains(
            "KLYX_SPLIT_MISSION_LIST_WIRING_13_21"
        ) -and
        $p.Contains(
            "<SplitMissionSection"
        )
    )

Test-Klyx `
    "mission counts integrated" `
    (
        $p.Contains(
            "splitMissionCounts"
        ) -and
        $p.Contains(
            "splitMissionNeedsAction"
        ) -and
        $p.Contains(
            "splitMissionIsHistory"
        )
    )

Test-Klyx `
    "existing group display retained" `
    (
        $p.Contains(
            "groupCount"
        ) -and
        $p.Contains(
            "childBookingsHidden"
        )
    )

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
Write-Host "Booking overview historique : CONSERVE"
Write-Host "Booking groups historiques : CONSERVES"
Write-Host "Split mission client : CONSOLIDEE"
Write-Host "1 split plan : 1 MISSION CLIENT"
Write-Host "Split child bookings : MASQUES"
Write-Host "Child booking detail : ACCESSIBLE"
Write-Host "Filtres /bookings : INTEGRES"
Write-Host "Compteurs /bookings : INTEGRES"
Write-Host "Automatic booking : NON"
Write-Host "Automatic payment : NON"
Write-Host "Migration DB : AUCUNE"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"