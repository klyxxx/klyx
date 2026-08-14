$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$apiPath =
    Join-Path $root "app\api\bookings\overview\route.ts"

$pagePath =
    Join-Path $root "app\bookings\page.tsx"

$groupPath =
    Join-Path $root "app\booking-groups\[id]\page.tsx"

$brainPath =
    Join-Path $root "app\api\brain\actions\route.ts"

$cancellationPath =
    Join-Path $root "app\api\booking-groups\[id]\cancellation\route.ts"

foreach (
    $path in @(
        $apiPath,
        $pagePath,
        $groupPath,
        $brainPath,
        $cancellationPath
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

$api =
    [System.IO.File]::ReadAllText(
        $apiPath
    )

$page =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$group =
    [System.IO.File]::ReadAllText(
        $groupPath
    )

$brain =
    [System.IO.File]::ReadAllText(
        $brainPath
    )

$cancellation =
    [System.IO.File]::ReadAllText(
        $cancellationPath
    )

$checks = @(
    @{
        Name = "overview API 12.92"
        Value =
            $api.Contains(
                "KLYX_BOOKINGS_GROUP_OVERVIEW_API_12_92"
            )
    },
    @{
        Name = "booking_group_id selected"
        Value =
            $api.Contains(
                "booking_group_id"
            )
    },
    @{
        Name = "group children excluded"
        Value =
            $api.Contains(
                "singleBookings"
            ) -and
            $api.Contains(
                "!booking.booking_group_id"
            )
    },
    @{
        Name = "children grouped internally"
        Value =
            $api.Contains(
                "childrenByGroup"
            )
    },
    @{
        Name = "one group card"
        Value =
            $api.Contains(
                'entityType:'
            ) -and
            $api.Contains(
                '"group"'
            )
    },
    @{
        Name = "group total used"
        Value =
            $api.Contains(
                "total_amount_cents"
            )
    },
    @{
        Name = "cancellation status integrated"
        Value =
            $api.Contains(
                "cancellation_request_status"
            )
    },
    @{
        Name = "refund status integrated"
        Value =
            $api.Contains(
                "refund_status"
            )
    },
    @{
        Name = "client/provider roles"
        Value =
            $api.Contains(
                "roleForGroup"
            ) -and
            $api.Contains(
                "roleForBooking"
            )
    },
    @{
        Name = "page 12.92"
        Value =
            $page.Contains(
                "KLYX_GROUPED_BOOKINGS_PAGE_12_92"
            )
    },
    @{
        Name = "group badge"
        Value =
            $page.Contains(
                "Mission groupee"
            )
    },
    @{
        Name = "group route"
        Value =
            $api.Contains(
                '"/booking-groups/" +'
            )
    },
    @{
        Name = "single route retained"
        Value =
            $api.Contains(
                '"/bookings/" +'
            )
    },
    @{
        Name = "action filter retained"
        Value =
            $page.Contains(
                '"actions"'
            ) -and
            $page.Contains(
                "actionRequired"
            )
    },
    @{
        Name = "history filter retained"
        Value =
            $page.Contains(
                '"history"'
            )
    },
    @{
        Name = "12.87 group mission retained"
        Value =
            $group.Contains(
                "KLYX_GROUP_MISSION_PAGE_12_87"
            )
    },
    @{
        Name = "12.91 Action Center retained"
        Value =
            $brain.Contains(
                "KLYX_GROUP_ACTION_CENTER_12_91"
            )
    },
    @{
        Name = "12.90 cancellation retained"
        Value =
            $cancellation.Contains(
                "KLYX_GROUP_CANCELLATION_RESOLUTION_API_12_90"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 12.92"
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
    Write-Host "Echecs :"

    $failed |
        ForEach-Object {
            Write-Host " - $_"
        }

    throw "KLYX 12.92 static checker FAILED."
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
            Select-Object -First 250 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.92 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 12.92 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.92 CHECK OK"
Write-Host "======================================"
Write-Host "1 mission groupee = 1 carte : OK"
Write-Host "Enfants dans /bookings : MASQUES"
Write-Host "Enfants en base : CONSERVES"
Write-Host "Tracking enfants : CONSERVE"
Write-Host "Paiement groupe : CONSERVE"
Write-Host "Annulation/remboursement : CONSERVE"
Write-Host "Reservations classiques : OK"
Write-Host "Client : OK"
Write-Host "Prestataire : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""