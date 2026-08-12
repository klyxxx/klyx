$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$settingsPath = Join-Path `
    $projectRoot `
    "app\settings\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.67b"
Write-Host ""

$settings =
    [System.IO.File]::ReadAllText(
        $settingsPath
    )

if (-not $settings.Contains(
    "KLYX_PHONE_SETTINGS_ENTRY_12_67B"
)) {
    throw "Entree Telephone absente de /settings."
}

if (-not $settings.Contains(
    'href="/settings/phone"'
)) {
    throw "Lien /settings/phone absent."
}

$sidebarFound = $false

$roots = @(
    (Join-Path $projectRoot "app"),
    (Join-Path $projectRoot "components")
)

foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) {
        continue
    }

    $files = Get-ChildItem `
        -LiteralPath $root `
        -Recurse `
        -File `
        -Filter "*.tsx"

    foreach ($file in $files) {
        $content =
            [System.IO.File]::ReadAllText(
                $file.FullName
            )

        if ($content.Contains(
            "KLYX_FIXED_APP_SIDEBAR_12_67B"
        )) {
            $sidebarFound = $true

            if (-not $content.Contains(
                "sticky top-0 h-screen"
            )) {
                throw "Classes sticky sidebar absentes."
            }
        }
    }
}

if (-not $sidebarFound) {
    throw "Sidebar KLYX 12.67b introuvable."
}

Write-Host "[OK] Sidebar fixe"
Write-Host "[OK] Telephone visible dans Parametres"
Write-Host "[OK] /settings/phone relie"
Write-Host ""

Push-Location $projectRoot

try {
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

        throw "KLYX 12.67b TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.67b build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.67b CHECK OK"
Write-Host "Sidebar fixe."
Write-Host "Telephone visible dans Parametres."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""