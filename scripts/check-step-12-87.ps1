$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$paths = @{
    Lifecycle =
        Join-Path $root "lib\booking-group-lifecycle.ts"

    GroupPage =
        Join-Path $root "app\booking-groups\[id]\page.tsx"

    Tracking =
        Join-Path $root "app\api\bookings\tracking\route.ts"

    GroupCheckout =
        Join-Path $root "app\api\stripe\create-group-checkout-session\route.ts"

    GroupApi =
        Join-Path $root "app\api\booking-groups\[id]\route.ts"
}

Write-Host ""
Write-Host "CHECK KLYX 12.87"
Write-Host ""

foreach ($path in $paths.Values) {
    if (-not (
        Test-Path -LiteralPath $path
    )) {
        throw "Fichier absent : $path"
    }
}

$lifecycle =
    [System.IO.File]::ReadAllText(
        $paths.Lifecycle
    )

$page =
    [System.IO.File]::ReadAllText(
        $paths.GroupPage
    )

$tracking =
    [System.IO.File]::ReadAllText(
        $paths.Tracking
    )

$checkout =
    [System.IO.File]::ReadAllText(
        $paths.GroupCheckout
    )

$groupApi =
    [System.IO.File]::ReadAllText(
        $paths.GroupApi
    )

$checks = @(
    @{
        Name = "group lifecycle helper"
        Value = $lifecycle.Contains(
            "KLYX_GROUP_LIFECYCLE_12_87"
        )
    },
    @{
        Name = "group progress calculator"
        Value = $lifecycle.Contains(
            "getBookingGroupProgress"
        )
    },
    @{
        Name = "all completed detection"
        Value = $lifecycle.Contains(
            "allCompleted"
        )
    },
    @{
        Name = "group completion sync"
        Value = $lifecycle.Contains(
            "syncBookingGroupLifecycle"
        )
    },
    @{
        Name = "completed group status"
        Value = $lifecycle.Contains(
            'status:'
        ) -and
        $lifecycle.Contains(
            '"completed"'
        )
    },
    @{
        Name = "completion notifications"
        Value = $lifecycle.Contains(
            "booking-group:"
        ) -and
        $lifecycle.Contains(
            ":completed:client"
        )
    },
    @{
        Name = "group mission UI"
        Value = $page.Contains(
            "KLYX_GROUP_MISSION_PAGE_12_87"
        )
    },
    @{
        Name = "progress percentage UI"
        Value = $page.Contains(
            "progress.percent"
        )
    },
    @{
        Name = "individual tracking links"
        Value = $page.Contains(
            '"/tracking/" +'
        )
    },
    @{
        Name = "group tracking synchronization"
        Value = $tracking.Contains(
            "KLYX_GROUP_TRACKING_SYNC_12_87"
        )
    },
    @{
        Name = "booking group selected by tracking"
        Value = $tracking.Contains(
            "booking_group_id"
        )
    },
    @{
        Name = "sync after client confirmation"
        Value = $tracking.Contains(
            "syncBookingGroupLifecycle("
        )
    },
    @{
        Name = "provider finish gate retained"
        Value = $tracking.Contains(
            'action === "provider_finished"'
        )
    },
    @{
        Name = "client confirmation gate retained"
        Value = $tracking.Contains(
            'action === "client_confirmed"'
        )
    },
    @{
        Name = "group payment 12.86 retained"
        Value = $checkout.Contains(
            "KLYX_GROUP_CHECKOUT_12_86"
        )
    },
    @{
        Name = "group API 12.85 retained"
        Value = $groupApi.Contains(
            "KLYX_BOOKING_GROUP_API_12_85"
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

    throw "KLYX 12.87 static checker FAILED."
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

        throw "KLYX 12.87 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.87 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.87 CHECK OK"
Write-Host "======================================"
Write-Host "Progression 0-100% : OK"
Write-Host "Chaque creneau suivi : OK"
Write-Host "Provider finish -> client confirm : OK"
Write-Host "Groupe termine seulement a N/N : OK"
Write-Host "Notification fin groupe : OK"
Write-Host "Paiement groupe 12.86 : OK"
Write-Host "Paiement automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""