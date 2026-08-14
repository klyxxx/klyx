$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$sidebarPath =
    Join-Path $projectRoot "app\ui\AppSidebar.tsx"

$settingsPath =
    Join-Path $projectRoot "app\settings\page.tsx"

$globalsPath =
    Join-Path $projectRoot "app\globals.css"

Write-Host ""
Write-Host "CHECK KLYX 12.67f"
Write-Host ""

$sidebar =
    [System.IO.File]::ReadAllText(
        $sidebarPath
    )

$settings =
    [System.IO.File]::ReadAllText(
        $settingsPath
    )

$globals =
    [System.IO.File]::ReadAllText(
        $globalsPath
    )

$checks = @(
    @{
        Name = "sidebar fixed"
        Value = $sidebar.Contains(
            "fixed inset-y-0 left-0 z-50"
        )
    },
    @{
        Name = "header sidebar fixe"
        Value = $sidebar.Contains(
            'className="shrink-0 px-5 pb-4 pt-6"'
        )
    },
    @{
        Name = "nav scroll seulement"
        Value = $sidebar.Contains(
            "min-h-0 flex-1 space-y-1 overflow-y-auto"
        )
    },
    @{
        Name = "spacer desktop"
        Value = $sidebar.Contains(
            "KLYX_SIDEBAR_SPACER_12_67F"
        )
    },
    @{
        Name = "ancien data attr retire"
        Value = -not $sidebar.Contains(
            'data-klyx-fixed-sidebar="true"'
        )
    },
    @{
        Name = "ancien CSS retire"
        Value = -not $globals.Contains(
            "KLYX_FIXED_SIDEBAR_REPAIR_12_67D"
        )
    },
    @{
        Name = "telephone vrai contenu"
        Value = $settings.Contains(
            "KLYX_REAL_SIDEBAR_PHONE_REPAIR_12_67F"
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

$phoneCount =
    [regex]::Matches(
        $settings,
        '<PhoneSettingsInline\s*/>'
    ).Count

if ($phoneCount -eq 1) {
    Write-Host "[OK]   telephone unique"
}
else {
    Write-Host "[FAIL] telephone count = $phoneCount"
    $failed += "telephone unique"
}

if ($failed.Count -gt 0) {
    throw "KLYX 12.67f static checker FAILED."
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
            Select-Object -First 100 |
            ForEach-Object {
                Write-Host $_
            }

        throw "TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "Build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.67f CHECK OK"
Write-Host "Sidebar fixe sans chevauchement."
Write-Host "Telephone visible dans Parametres."
Write-Host "Build valide."
Write-Host "======================================"
Write-Host ""