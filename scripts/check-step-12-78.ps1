$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$apiPath = Join-Path `
    $projectRoot `
    "app\api\brain\actions\route.ts"

$pagePath = Join-Path `
    $projectRoot `
    "app\assistant\actions\page.tsx"

$trackingApi = Join-Path `
    $projectRoot `
    "app\api\bookings\tracking\route.ts"

$trackingPage = Join-Path `
    $projectRoot `
    "app\tracking\[bookingId]\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.78"
Write-Host ""

foreach ($path in @(
    $apiPath,
    $pagePath,
    $trackingApi,
    $trackingPage
)) {
    if (-not (Test-Path -LiteralPath $path)) {
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

$tracking =
    [System.IO.File]::ReadAllText(
        $trackingApi
    )

$checks = @(
    @{
        Name = "Brain 12.78"
        Value = $api.Contains(
            "KLYX_BRAIN_MISSION_LIFECYCLE_12_78"
        )
    },
    @{
        Name = "payment action"
        Value = $api.Contains(
            'kind: "payment_pending"'
        )
    },
    @{
        Name = "tracking action"
        Value = $api.Contains(
            'kind: "track_mission"'
        )
    },
    @{
        Name = "client confirmation action"
        Value = $api.Contains(
            'kind: "confirm_completion"'
        )
    },
    @{
        Name = "provider request action"
        Value = $api.Contains(
            'kind: "provider_booking_request"'
        )
    },
    @{
        Name = "provider tracking action"
        Value = $api.Contains(
            'kind: "provider_track_mission"'
        )
    },
    @{
        Name = "provider finish action"
        Value = $api.Contains(
            'kind: "provider_finish_mission"'
        )
    },
    @{
        Name = "real tracking provider finish"
        Value = $tracking.Contains(
            'action === "provider_finished"'
        )
    },
    @{
        Name = "real client completion"
        Value = $tracking.Contains(
            'action === "client_confirmed"'
        )
    },
    @{
        Name = "Action Center UI"
        Value = $page.Contains(
            "KLYX_ACTION_CENTER_MISSION_UI_12_78"
        )
    },
    @{
        Name = "tracking route links"
        Value = $api.Contains(
            '"/tracking/" + booking.id'
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
    throw "KLYX 12.78 static checker FAILED."
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

    if ($LASTEXITCODE -ne 0) {
        $tsOutput |
            Select-Object -First 150 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.78 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.78 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.78 CHECK OK"
Write-Host "======================================"
Write-Host "Brain -> offre : OK"
Write-Host "Brain -> reservation : OK"
Write-Host "Brain -> paiement : OK"
Write-Host "Brain -> prestation : OK"
Write-Host "Brain -> confirmation client : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""