$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$apiPath = Join-Path `
    $projectRoot `
    "app\api\profile\phone\access-history\route.ts"

$componentPath = Join-Path `
    $projectRoot `
    "app\settings\PhoneAccessHistory.tsx"

$settingsPath = Join-Path `
    $projectRoot `
    "app\settings\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.76"
Write-Host ""

foreach ($path in @(
    $apiPath,
    $componentPath,
    $settingsPath
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

$settings =
    [System.IO.File]::ReadAllText(
        $settingsPath
    )

$checks = @(
    @{
        Name = "API 12.76"
        Value = $api.Contains(
            "KLYX_PHONE_ACCESS_HISTORY_API_12_76"
        )
    },
    @{
        Name = "owner-only query"
        Value = $api.Contains(
            '.eq("contact_profile_id", profile.id)'
        )
    },
    @{
        Name = "30 records maximum"
        Value = $api.Contains(
            ".limit(30)"
        )
    },
    @{
        Name = "reveal history"
        Value = $api.Contains(
            '"phone_explicit_reveal"'
        )
    },
    @{
        Name = "call history"
        Value = $api.Contains(
            '"phone_call_started"'
        )
    },
    @{
        Name = "API does not select phone"
        Value = -not $api.Contains(
            "phone_number"
        )
    },
    @{
        Name = "UI 12.76"
        Value = $component.Contains(
            "KLYX_PHONE_ACCESS_HISTORY_UI_12_76"
        )
    },
    @{
        Name = "settings import"
        Value = $settings.Contains(
            'import PhoneAccessHistory from "./PhoneAccessHistory";'
        )
    },
    @{
        Name = "settings render"
        Value = $settings.Contains(
            "<PhoneAccessHistory />"
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
    throw "KLYX 12.76 static checker FAILED."
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

        throw "KLYX 12.76 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.76 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.76 CHECK OK"
Write-Host "Historique confidentialite operationnel."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""