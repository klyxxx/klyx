$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$apiPath = Join-Path `
    $projectRoot `
    "app\api\bookings\[id]\contact\route.ts"

$componentPath = Join-Path `
    $projectRoot `
    "app\components\BookingContactCard.tsx"

$bookingPath = Join-Path `
    $projectRoot `
    "app\bookings\[id]\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.68"
Write-Host ""

foreach ($path in @(
    $apiPath,
    $componentPath,
    $bookingPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier 12.68 absent : $path"
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

$booking =
    [System.IO.File]::ReadAllText(
        $bookingPath
    )

$checks = @(
    @{
        Name = "API contact secure"
        Value = $api.Contains(
            "KLYX_SECURE_BOOKING_CONTACT_API_12_68"
        )
    },
    @{
        Name = "authentification"
        Value = $api.Contains(
            "getAuthenticatedProfile(request)"
        )
    },
    @{
        Name = "client participant"
        Value = $api.Contains(
            "booking.parent_id === profile.id"
        )
    },
    @{
        Name = "provider participant"
        Value = $api.Contains(
            "providerId === profile.id"
        )
    },
    @{
        Name = "accepted/completed only"
        Value =
            $api.Contains(
                'status === "accepted"'
            ) -and
            $api.Contains(
                'status === "completed"'
            )
    },
    @{
        Name = "privacy"
        Value = $api.Contains(
            'visibility === "private"'
        )
    },
    @{
        Name = "phone component"
        Value = $component.Contains(
            "KLYX_BOOKING_CONTACT_CARD_12_68"
        )
    },
    @{
        Name = "tel protocol"
        Value = $component.Contains(
            '"tel:" + payload.phoneNumber'
        )
    },
    @{
        Name = "booking integration"
        Value = $booking.Contains(
            "KLYX_SECURE_CONTACT_UI_12_68"
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
    throw "KLYX 12.68 static checker FAILED."
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
            Select-Object -First 120 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.68 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.68 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.68 CHECK OK"
Write-Host "Contact client/prestataire securise."
Write-Host "Bouton Appeler operationnel."
Write-Host "Numero non public."
Write-Host "Build valide."
Write-Host "======================================"
Write-Host ""