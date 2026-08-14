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
Write-Host "CHECK KLYX 12.74"
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
        Name = "API 12.74"
        Value = $api.Contains(
            "KLYX_REVALIDATED_PHONE_CALL_API_12_74"
        )
    },
    @{
        Name = "GET hides phone"
        Value = $api.Contains(
            "phoneNumber: null"
        )
    },
    @{
        Name = "POST reveal"
        Value = $api.Contains(
            "export async function POST"
        )
    },
    @{
        Name = "PUT call"
        Value = $api.Contains(
            "export async function PUT"
        )
    },
    @{
        Name = "reveal audit"
        Value = $api.Contains(
            '"phone_explicit_reveal"'
        )
    },
    @{
        Name = "call audit"
        Value = $api.Contains(
            '"phone_call_started"'
        )
    },
    @{
        Name = "5 minute remask"
        Value = $api.Contains(
            "DISPLAY_MINUTES = 5"
        )
    },
    @{
        Name = "UI 12.74"
        Value = $component.Contains(
            "KLYX_REVALIDATED_PHONE_CALL_UI_12_74"
        )
    },
    @{
        Name = "PUT before call"
        Value = $component.Contains(
            'method: "PUT"'
        )
    },
    @{
        Name = "tel after server validation"
        Value = $component.Contains(
            'window.location.href ='
        ) -and $component.Contains(
            '"tel:" + result.phoneNumber'
        )
    },
    @{
        Name = "manual hide"
        Value = $component.Contains(
            "Masquer"
        )
    },
    @{
        Name = "auto hide"
        Value = $component.Contains(
            "window.setTimeout"
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
    throw "KLYX 12.74 static checker FAILED."
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

        throw "KLYX 12.74 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.74 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.74 CHECK OK"
Write-Host "Appel revalide cote serveur."
Write-Host "Numero remasque automatiquement."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""