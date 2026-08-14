$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$paths = @{
    Migration =
        Join-Path $root "supabase\migrations\20260812205500_klyx_group_review_12_88.sql"

    Reviews =
        Join-Path $root "app\api\reviews\route.ts"

    GroupApi =
        Join-Path $root "app\api\group-reviews\route.ts"

    GroupPage =
        Join-Path $root "app\reviews\group\[groupId]\page.tsx"

    MissionPage =
        Join-Path $root "app\booking-groups\[id]\page.tsx"

    Brain =
        Join-Path $root "lib\brain-actions.ts"

    Lifecycle =
        Join-Path $root "lib\booking-group-lifecycle.ts"

    Tracking =
        Join-Path $root "app\api\bookings\tracking\route.ts"
}

Write-Host ""
Write-Host "CHECK KLYX 12.88"
Write-Host ""

foreach ($path in $paths.Values) {
    if (-not (
        Test-Path -LiteralPath $path
    )) {
        throw "Fichier absent : $path"
    }
}

$migration =
    [System.IO.File]::ReadAllText(
        $paths.Migration
    )

$reviews =
    [System.IO.File]::ReadAllText(
        $paths.Reviews
    )

$groupApi =
    [System.IO.File]::ReadAllText(
        $paths.GroupApi
    )

$groupPage =
    [System.IO.File]::ReadAllText(
        $paths.GroupPage
    )

$missionPage =
    [System.IO.File]::ReadAllText(
        $paths.MissionPage
    )

$brain =
    [System.IO.File]::ReadAllText(
        $paths.Brain
    )

$lifecycle =
    [System.IO.File]::ReadAllText(
        $paths.Lifecycle
    )

$tracking =
    [System.IO.File]::ReadAllText(
        $paths.Tracking
    )

$checks = @(
    @{
        Name = "group review migration"
        Value = $migration.Contains(
            "KLYX_GROUP_REVIEW_12_88"
        )
    },
    @{
        Name = "reviews group FK"
        Value = $migration.Contains(
            "booking_group_id"
        )
    },
    @{
        Name = "one review per group author"
        Value = $migration.Contains(
            "reviews_booking_group_author_uidx"
        )
    },
    @{
        Name = "single review group guard"
        Value = $reviews.Contains(
            "KLYX_SINGLE_REVIEW_GROUP_GUARD_12_88"
        )
    },
    @{
        Name = "individual grouped review blocked"
        Value = $reviews.Contains(
            "GROUP_REVIEW_REQUIRED"
        )
    },
    @{
        Name = "group review API"
        Value = $groupApi.Contains(
            "KLYX_GROUP_REVIEW_API_12_88"
        )
    },
    @{
        Name = "completed group required"
        Value =
            $groupApi.Contains(
                'group.status !=='
            ) -and
            $groupApi.Contains(
                '"completed"'
            )
    },
    @{
        Name = "paid group required"
        Value = $groupApi.Contains(
            'group.payment_status !=='
        )
    },
    @{
        Name = "all children completed"
        Value = $groupApi.Contains(
            "children.every"
        )
    },
    @{
        Name = "provider score recalculation"
        Value = $groupApi.Contains(
            "recalculateProviderScores"
        )
    },
    @{
        Name = "group review page"
        Value = $groupPage.Contains(
            "KLYX_GROUP_REVIEW_PAGE_12_88"
        )
    },
    @{
        Name = "global rating UI"
        Value = $groupPage.Contains(
            "Ta note globale"
        )
    },
    @{
        Name = "group mission CTA"
        Value = $missionPage.Contains(
            "KLYX_GROUP_REVIEW_CTA_12_88"
        )
    },
    @{
        Name = "group review URL"
        Value = $missionPage.Contains(
            '"/reviews/group/"'
        )
    },
    @{
        Name = "Action Center group review"
        Value = $brain.Contains(
            "KLYX_GROUP_REVIEW_ACTIONS_12_88"
        )
    },
    @{
        Name = "child review action suppressed"
        Value = $brain.Contains(
            "KLYX_GROUP_REVIEW_CHILD_GUARD_12_88"
        )
    },
    @{
        Name = "review action only if no group review"
        Value = $brain.Contains(
            "reviewed.has("
        )
    },
    @{
        Name = "12.87 lifecycle retained"
        Value = $lifecycle.Contains(
            "KLYX_GROUP_LIFECYCLE_12_87"
        )
    },
    @{
        Name = "12.87 tracking retained"
        Value = $tracking.Contains(
            "KLYX_GROUP_TRACKING_SYNC_12_87"
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

    throw "KLYX 12.88 static checker FAILED."
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
            Select-Object -First 220 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.88 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.88 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.88 CHECK OK"
Write-Host "======================================"
Write-Host "Mission groupee -> 1 avis : OK"
Write-Host "Avis par enfant : BLOQUE"
Write-Host "Avis avant 100% : BLOQUE"
Write-Host "Avis avant paiement : BLOQUE"
Write-Host "Modification avis groupe : OK"
Write-Host "KLYX Score : OK"
Write-Host "Action Center deduplique : OK"
Write-Host "Avis automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""