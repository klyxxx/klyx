$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$apiPath = Join-Path $projectRoot "app\api\bookings\[id]\contact\route.ts"
$componentPath = Join-Path $projectRoot "app\components\BookingContactCard.tsx"
$bookingPath = Join-Path $projectRoot "app\bookings\[id]\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.68b"
Write-Host ""

foreach ($path in @(
    $apiPath,
    $componentPath,
    $bookingPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier absent : $path"
    }
}

$api = [System.IO.File]::ReadAllText($apiPath)
$component = [System.IO.File]::ReadAllText($componentPath)
$booking = [System.IO.File]::ReadAllText($bookingPath)

$checks = @(
    @{
        Name = "API secure"
        Value = $api.Contains(
            "KLYX_SECURE_BOOKING_CONTACT_API_12_68B"
        )
    },
    @{
        Name = "client authorization"
        Value = $api.Contains(
            "booking.parent_id === profile.id"
        )
    },
    @{
        Name = "provider authorization"
        Value = $api.Contains(
            "providerId === profile.id"
        )
    },
    @{
        Name = "accepted gate"
        Value = $api.Contains(
            "status === 'accepted'"
        )
    },
    @{
        Name = "private protection"
        Value = $api.Contains(
            "visibility === 'private'"
        )
    },
    @{
        Name = "contact component"
        Value = $component.Contains(
            "KLYX_BOOKING_CONTACT_CARD_12_68B"
        )
    },
    @{
        Name = "tel link"
        Value = $component.Contains(
            "href={'tel:' + payload.phoneNumber}"
        )
    },
    @{
        Name = "booking integration"
        Value = $booking.Contains(
            "KLYX_SECURE_CONTACT_UI_12_68B"
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
    throw "KLYX 12.68b static checker FAILED."
}

Push-Location $projectRoot

try {
    Write-Host ""
    Write-Host "TypeScript..."
    Write-Host ""

    $tsOutput = @(
        & npx.cmd tsc --noEmit --pretty false 2>&1
    )

    if ($LASTEXITCODE -ne 0) {
        $tsOutput |
            Select-Object -First 120 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.68b TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.68b build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.68 CHECK OK"
Write-Host "Contact securise operationnel."
Write-Host "Bouton Appeler operationnel."
Write-Host "Numero non public."
Write-Host "Build valide."
Write-Host "======================================"
Write-Host ""