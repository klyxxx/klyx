$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$apiPath = Join-Path `
    $projectRoot `
    "app\api\profile\phone\privacy\route.ts"

$componentPath = Join-Path `
    $projectRoot `
    "app\settings\PhonePrivacyControls.tsx"

$settingsPath = Join-Path `
    $projectRoot `
    "app\settings\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.75"
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
        Name = "API 12.75"
        Value = $api.Contains(
            "KLYX_PHONE_PRIVACY_API_12_75"
        )
    },
    @{
        Name = "GET privacy"
        Value = $api.Contains(
            "export async function GET"
        )
    },
    @{
        Name = "PUT privacy"
        Value = $api.Contains(
            "export async function PUT"
        )
    },
    @{
        Name = "private option"
        Value = $api.Contains(
            '"private"'
        )
    },
    @{
        Name = "transaction option"
        Value = $api.Contains(
            '"transaction_participants"'
        )
    },
    @{
        Name = "UI 12.75"
        Value = $component.Contains(
            "KLYX_PHONE_PRIVACY_UI_12_75"
        )
    },
    @{
        Name = "private CTA"
        Value = $component.Contains(
            "Toujours prive"
        )
    },
    @{
        Name = "participants CTA"
        Value = $component.Contains(
            "Participants de mission"
        )
    },
    @{
        Name = "settings import"
        Value = $settings.Contains(
            'import PhonePrivacyControls from "./PhonePrivacyControls";'
        )
    },
    @{
        Name = "settings render"
        Value = $settings.Contains(
            "<PhonePrivacyControls />"
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
    throw "KLYX 12.75 static checker FAILED."
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

        throw "KLYX 12.75 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.75 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.75 CHECK OK"
Write-Host "Confidentialite telephone operationnelle."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""