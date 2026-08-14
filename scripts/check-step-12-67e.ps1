$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$sidebarPath =
    Join-Path $projectRoot "app\ui\AppSidebar.tsx"

$settingsPath =
    Join-Path $projectRoot "app\settings\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.67e"
Write-Host ""

$sidebar =
    [System.IO.File]::ReadAllText(
        $sidebarPath
    )

$settings =
    [System.IO.File]::ReadAllText(
        $settingsPath
    )

$checks = @(
    @{
        Name = "vraie sidebar ciblee"
        Value = $sidebar.Contains(
            "KLYX_REAL_FIXED_SIDEBAR_12_67E"
        )
    },
    @{
        Name = "sidebar fixed"
        Value = $sidebar.Contains(
            "fixed inset-y-0 left-0"
        )
    },
    @{
        Name = "spacer desktop"
        Value = $sidebar.Contains(
            "KLYX_DESKTOP_SIDEBAR_SPACER_12_67E"
        )
    },
    @{
        Name = "nav scroll interne"
        Value = $sidebar.Contains(
            "flex-1 space-y-1 overflow-y-auto"
        )
    },
    @{
        Name = "classe corrompue retiree"
        Value = -not $sidebar.Contains(
            "shrink-0self-start"
        )
    },
    @{
        Name = "telephone vrai settings"
        Value = $settings.Contains(
            "KLYX_PHONE_REAL_SETTINGS_12_67E"
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
    Write-Host "[OK]   PhoneSettingsInline unique"
}
else {
    Write-Host "[FAIL] PhoneSettingsInline count = $phoneCount"
    $failed += "PhoneSettingsInline unique"
}

$mainReturn =
    $settings.LastIndexOf(
        "return ("
    )

$phoneIndex =
    $settings.IndexOf(
        "KLYX_PHONE_REAL_SETTINGS_12_67E"
    )

if (
    $phoneIndex -gt $mainReturn
) {
    Write-Host "[OK]   telephone apres loading"
}
else {
    Write-Host "[FAIL] telephone encore dans loading"
    $failed += "telephone placement"
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "ECHECS :"

    foreach ($name in $failed) {
        Write-Host " - $name"
    }

    throw "KLYX 12.67e static checker FAILED."
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
Write-Host "KLYX 12.67e CHECK OK"
Write-Host "Vraie sidebar fixe."
Write-Host "Telephone visible dans Settings."
Write-Host "Build valide."
Write-Host "======================================"
Write-Host ""