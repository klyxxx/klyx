$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$apiPath = Join-Path `
    $projectRoot `
    "app\api\bookings\[id]\contact\route.ts"

$componentPath = Join-Path `
    $projectRoot `
    "app\components\BookingContactCard.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.70"
Write-Host ""

foreach ($path in @(
    $apiPath,
    $componentPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier absent : $path"
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

$checks = @(
    @{
        Name = "API 12.70"
        Value = $api.Contains(
            "KLYX_MUTUAL_VERIFIED_CONTACT_API_12_70"
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
        Name = "own phone required"
        Value = $api.Contains(
            'reason: "own_missing_phone"'
        )
    },
    @{
        Name = "own OTP required"
        Value = $api.Contains(
            'reason: "own_unverified_phone"'
        )
    },
    @{
        Name = "other phone required"
        Value = $api.Contains(
            'reason: "other_missing_phone"'
        )
    },
    @{
        Name = "other OTP required"
        Value = $api.Contains(
            'reason: "other_unverified_phone"'
        )
    },
    @{
        Name = "mutual verification"
        Value = $api.Contains(
            "mutualVerification: true"
        )
    },
    @{
        Name = "UI 12.70"
        Value = $component.Contains(
            "KLYX_MUTUAL_VERIFIED_CONTACT_UI_12_70"
        )
    },
    @{
        Name = "settings CTA"
        Value = $component.Contains(
            'href="/settings"'
        )
    },
    @{
        Name = "telephone link"
        Value = $component.Contains(
            '"tel:" + payload.phoneNumber'
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
    throw "KLYX 12.70 static checker FAILED."
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

        throw "KLYX 12.70 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.70 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.70 CHECK OK"
Write-Host "Contact bilateral verifie."
Write-Host "Numero protege cote serveur."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""