$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$settingsPath =
    Join-Path $projectRoot "app\settings\page.tsx"

$phonePath =
    Join-Path $projectRoot "app\settings\PhoneSettingsInline.tsx"

$globalsPath =
    Join-Path $projectRoot "app\globals.css"

Write-Host ""
Write-Host "CHECK KLYX 12.67c"
Write-Host ""

foreach ($path in @(
    $settingsPath,
    $phonePath,
    $globalsPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier introuvable : $path"
    }
}

$settings =
    [System.IO.File]::ReadAllText(
        $settingsPath
    )

$phone =
    [System.IO.File]::ReadAllText(
        $phonePath
    )

$globals =
    [System.IO.File]::ReadAllText(
        $globalsPath
    )

if (-not $settings.Contains(
    "KLYX_PHONE_VISIBLE_SETTINGS_12_67C"
)) {
    throw "Telephone non injecte dans settings."
}

if (-not $settings.Contains(
    "<PhoneSettingsInline />"
)) {
    throw "PhoneSettingsInline absent."
}

if (-not $phone.Contains(
    'type="tel"'
)) {
    throw "Champ telephone absent."
}

if (-not $phone.Contains(
    "Enregistrer le numero"
)) {
    throw "Bouton telephone absent."
}

if (-not $globals.Contains(
    "KLYX_FIXED_SIDEBAR_12_67C"
)) {
    throw "CSS sidebar fixe absent."
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

    foreach ($file in (
        Get-ChildItem `
            -LiteralPath $root `
            -Recurse `
            -File `
            -Filter "*.tsx"
    )) {
        $content =
            [System.IO.File]::ReadAllText(
                $file.FullName
            )

        if ($content.Contains(
            'data-klyx-fixed-sidebar="true"'
        )) {
            $sidebarFound = $true
            Write-Host "Sidebar : $($file.FullName)"
            break
        }
    }
}

if (-not $sidebarFound) {
    throw "Attribut fixed sidebar introuvable."
}

Write-Host "[OK] Telephone visible"
Write-Host "[OK] Input telephone visible"
Write-Host "[OK] Bouton enregistrer visible"
Write-Host "[OK] Sidebar fixed"
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
Write-Host "KLYX 12.67c CHECK OK"
Write-Host "Telephone visible dans /settings."
Write-Host "Sidebar totalement fixe."
Write-Host "Build valide."
Write-Host "======================================"
Write-Host ""