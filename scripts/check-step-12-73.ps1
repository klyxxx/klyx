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
Write-Host "CHECK KLYX 12.73"
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
        Name = "API 12.73"
        Value = $api.Contains(
            "KLYX_EXPLICIT_PHONE_REVEAL_API_12_73"
        )
    },
    @{
        Name = "GET endpoint"
        Value = $api.Contains(
            "export async function GET"
        )
    },
    @{
        Name = "POST endpoint"
        Value = $api.Contains(
            "export async function POST"
        )
    },
    @{
        Name = "GET masks phone"
        Value = $api.Contains(
            "phoneNumber: null"
        )
    },
    @{
        Name = "explicit audit event"
        Value = $api.Contains(
            'event_type:'
        ) -and $api.Contains(
            '"phone_explicit_reveal"'
        )
    },
    @{
        Name = "UI 12.73"
        Value = $component.Contains(
            "KLYX_EXPLICIT_PHONE_REVEAL_UI_12_73"
        )
    },
    @{
        Name = "reveal CTA"
        Value = $component.Contains(
            "Afficher le numero"
        )
    },
    @{
        Name = "explicit POST"
        Value = $component.Contains(
            'method: "POST"'
        )
    },
    @{
        Name = "telephone hidden initially"
        Value = $component.Contains(
            "!payload.revealed"
        )
    },
    @{
        Name = "call button"
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
    throw "KLYX 12.73 static checker FAILED."
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

        throw "KLYX 12.73 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.73 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.73 CHECK OK"
Write-Host "Numero masque par defaut."
Write-Host "Revelation explicite securisee."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""